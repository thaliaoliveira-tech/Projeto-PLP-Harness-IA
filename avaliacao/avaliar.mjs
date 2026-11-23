#!/usr/bin/env node
// Kit de avaliação: mede UMA implementação da mesma forma para os grupos A e B.
//
// Uso:
//   node avaliacao/avaliar.mjs --projeto <dir> --saida <dir> [--rotulo texto] [--sem-aceitacao]
//
// Gera em <saida>/:
//   metricas.json     números (build, tipos, lint, testes de aceitação, violações, código, integridade do harness)
//   avaliacao.md      relatório legível
//   intervencao.md    prompt de intervenção padronizado (só se houver problemas)
//   servidor.log      saída do servidor durante os testes de aceitação
//   etapas/*.log      saída bruta de cada etapa
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(KIT, '..');
const VERIFICADOR = join(RAIZ, 'projetos/harness/scripts/verificar-reatividade.mjs');
const OXLINT_CONFIG = join(RAIZ, 'projetos/base/.oxlintrc.json');
const VERSAO_KIT = 1;

// ------------------------------------------------------------------ argumentos

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
};
const PROJETO = resolve(opcao('--projeto') ?? '.');
const SAIDA = resolve(opcao('--saida') ?? join(KIT, '.tmp', 'ultima-avaliacao'));
const ROTULO = opcao('--rotulo') ?? '';
const SEM_ACEITACAO = args.includes('--sem-aceitacao');
// A suíte roda N vezes contra o mesmo servidor: um teste conta como falho se falhar em QUALQUER
// repetição (pega bugs intermitentes, ex.: temporizadores) e é marcado como instável se oscilar.
const REPETICOES = Number(opcao('--repeticoes') ?? 2);

if (!existsSync(join(PROJETO, 'package.json'))) {
  console.error(`erro: ${PROJETO} não parece um projeto Node (sem package.json)`);
  process.exit(2);
}
mkdirSync(join(SAIDA, 'etapas'), { recursive: true });

// ------------------------------------------------------------------ utilidades

const semAnsi = (s) => String(s ?? '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
const ultimas = (s, n) => semAnsi(s).trimEnd().split('\n').slice(-n).join('\n');
const ENV = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', CI: '1' };

function executar(nome, comando, argumentos, { cwd = PROJETO, timeoutMs = 300_000, env = ENV } = {}) {
  const inicio = Date.now();
  const r = spawnSync(comando, argumentos, { cwd, env, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  const saida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  writeFileSync(join(SAIDA, 'etapas', `${nome}.log`), `$ ${comando} ${argumentos.join(' ')}\n\n${saida}`);
  return { status: r.status ?? -1, saida, duracaoMs: Date.now() - inicio, estourouTempo: r.error?.code === 'ETIMEDOUT' };
}

function listarArquivos(dir, filtro) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((nome) => {
    if (nome === 'node_modules' || nome === 'dist' || nome === '.git' || nome === '.harness') return [];
    const c = join(dir, nome);
    return statSync(c).isDirectory() ? listarArquivos(c, filtro) : filtro(c) ? [c] : [];
  });
}

const linhasDeCodigo = (arquivo) =>
  readFileSync(arquivo, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '' && !/^\s*(\/\/|\*|\/\*)/.test(l)).length;

const portaLivre = () =>
  new Promise((ok, erro) => {
    const s = createServer();
    s.unref();
    s.on('error', erro);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function hashArquivo(c) {
  return createHash('sha256').update(readFileSync(c)).digest('hex');
}

// ------------------------------------------------------------------ etapas

const m = {
  versaoKit: VERSAO_KIT,
  avaliadoEm: new Date().toISOString(),
  projeto: { caminho: PROJETO, rotulo: ROTULO, commit: null },
  instalacao: null,
  tipos: null,
  build: null,
  lint: null,
  arquitetura: null,
  aceitacao: null,
  codigo: null,
  harness: null,
};

const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: PROJETO, encoding: 'utf8' });
if (git.status === 0) m.projeto.commit = git.stdout.trim();

// 1. dependências instaladas?
{
  const precisa = !existsSync(join(PROJETO, 'node_modules'));
  let r = { status: 0, duracaoMs: 0, saida: '' };
  if (precisa) {
    r = executar('instalacao', 'npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund']);
    if (r.status !== 0) r = executar('instalacao', 'npm', ['install', '--prefer-offline', '--no-audit', '--no-fund']);
  }
  m.instalacao = { executada: precisa, ok: r.status === 0, duracaoMs: r.duracaoMs };
}

// 2. checagem de tipos (inclui os testes escritos pelo agente)
{
  const r = executar('tipos', 'npx', ['tsc', '--noEmit', '-p', 'tsconfig.json']);
  const erros = semAnsi(r.saida).match(/error TS\d+/g)?.length ?? 0;
  m.tipos = { ok: r.status === 0, erros, duracaoMs: r.duracaoMs };
}

// 3. build de produção
{
  rmSync(join(PROJETO, 'dist'), { recursive: true, force: true });
  const r = executar('build', 'npm', ['run', 'build']);
  m.build = { ok: r.status === 0, duracaoMs: r.duracaoMs, saida: r.status === 0 ? '' : ultimas(r.saida, 40) };
}

// 4. lint genérico com a configuração FIXA da base (igual para A e B)
{
  const r = executar('lint', 'npx', ['oxlint', '--type-aware', '-c', OXLINT_CONFIG, '--format', 'json', 'src/']);
  let erros = 0;
  let avisos = 0;
  let porRegra = {};
  try {
    const json = JSON.parse(r.saida.slice(r.saida.indexOf('{')));
    for (const d of json.diagnostics ?? []) {
      if (d.severity === 'error') erros++;
      else avisos++;
      porRegra[d.code] = (porRegra[d.code] ?? 0) + 1;
    }
  } catch {
    porRegra = { 'falha-ao-executar-lint': 1 };
    erros = r.status === 0 ? 0 : 1;
  }
  m.lint = { erros, avisos, porRegra };
}

// 5. regras de arquitetura reativa (RX01–RX09) — mesmo verificador do harness, cópia do repositório principal
{
  const r = executar('arquitetura', process.execPath, [VERIFICADOR, '--raiz', PROJETO, '--json'], { cwd: KIT });
  try {
    const json = JSON.parse(r.saida.slice(r.saida.indexOf('{')));
    m.arquitetura = { total: json.total, porRegra: json.porRegra, violacoes: json.violacoes, arquivosAnalisados: json.arquivosAnalisados };
  } catch {
    m.arquitetura = { total: null, porRegra: {}, violacoes: [], erro: ultimas(r.saida, 20) };
  }
}

// 6. testes de aceitação ocultos (servidor real, via HTTP)
async function aceitacao() {
  const total = contarTestesDeAceitacao();
  if (SEM_ACEITACAO) return { executada: false, motivo: 'desativada por opção', total, passaram: 0, falharam: 0, falhas: [] };
  if (!m.build.ok) {
    return { executada: false, motivo: 'build falhou', servidorIniciou: false, total, passaram: 0, falharam: total, falhas: [] };
  }
  const porta = await portaLivre();
  const log = [];
  const servidor = spawn('npm', ['run', 'start:prod'], {
    cwd: PROJETO,
    env: { ...ENV, PORT: String(porta) },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let encerrado = false;
  servidor.stdout.on('data', (d) => log.push(d.toString()));
  servidor.stderr.on('data', (d) => log.push(d.toString()));
  servidor.on('exit', () => (encerrado = true));
  const parar = () => {
    try {
      process.kill(-servidor.pid, 'SIGTERM');
    } catch {
      /* já terminou */
    }
  };

  const url = `http://127.0.0.1:${porta}`;
  let iniciou = false;
  for (let i = 0; i < 150 && !encerrado; i++) {
    try {
      await fetch(`${url}/`, { signal: AbortSignal.timeout(1000) });
      iniciou = true;
      break;
    } catch {
      await esperar(200);
    }
  }
  if (!iniciou) {
    parar();
    writeFileSync(join(SAIDA, 'servidor.log'), semAnsi(log.join('')));
    return {
      executada: false,
      motivo: 'servidor não iniciou com npm run start:prod',
      servidorIniciou: false,
      logServidor: ultimas(log.join(''), 30),
      total,
      passaram: 0,
      falharam: total,
      falhas: [],
    };
  }

  const rodadas = [];
  for (let rep = 1; rep <= REPETICOES && !encerrado; rep++) {
    const relatorio = join(SAIDA, 'etapas', `aceitacao-${rep}.json`);
    rmSync(relatorio, { force: true });
    const r = await new Promise((ok) => {
      const p = spawn(
        'npx',
        ['vitest', 'run', '--config', 'vitest.config.ts', '--reporter=json', `--outputFile=${relatorio}`],
        { cwd: KIT, env: { ...ENV, URL_ALVO: url }, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let saida = '';
      p.stdout.on('data', (d) => (saida += d));
      p.stderr.on('data', (d) => (saida += d));
      const limite = setTimeout(() => p.kill('SIGKILL'), 240_000);
      p.on('exit', (status) => {
        clearTimeout(limite);
        ok({ status, saida });
      });
    });
    writeFileSync(join(SAIDA, 'etapas', `aceitacao-${rep}.log`), semAnsi(r.saida));
    try {
      const json = JSON.parse(readFileSync(relatorio, 'utf8'));
      rodadas.push(
        json.testResults.flatMap((arquivo) =>
          arquivo.assertionResults.map((a) => ({
            arquivo: relative(join(KIT, 'aceitacao'), arquivo.name).split(sep).join('/'),
            nome: a.fullName ?? [...(a.ancestorTitles ?? []), a.title].join(' › '),
            status: a.status,
            mensagem: limparFalha(a.failureMessages?.join('\n') ?? ''),
          })),
        ),
      );
    } catch {
      /* rodada sem relatório: tratada abaixo */
    }
  }
  parar();
  await esperar(300);
  writeFileSync(join(SAIDA, 'servidor.log'), semAnsi(log.join('')));

  if (rodadas.length === 0) {
    return { executada: false, motivo: 'falha ao rodar a suíte de aceitação', servidorIniciou: true, total, passaram: 0, falharam: total, falhas: [] };
  }
  // Consolida: falhou se falhou em alguma rodada; instável se passou em uma e falhou em outra.
  const porNome = new Map();
  for (const rodada of rodadas) {
    for (const c of rodada) {
      const atual = porNome.get(c.nome) ?? { ...c, falhasEm: 0, rodadas: 0 };
      atual.rodadas++;
      if (c.status !== 'passed') {
        atual.falhasEm++;
        atual.mensagem = atual.mensagem || c.mensagem;
        if (atual.status === 'passed') atual.mensagem = c.mensagem;
      }
      atual.status = atual.falhasEm > 0 ? 'failed' : 'passed';
      porNome.set(c.nome, atual);
    }
  }
  const casos = [...porNome.values()].map((c) => ({ ...c, instavel: c.falhasEm > 0 && c.falhasEm < c.rodadas }));
  const falhas = casos.filter((c) => c.status !== 'passed');
  const porArquivo = {};
  for (const c of casos) {
    porArquivo[c.arquivo] ??= { total: 0, falharam: 0 };
    porArquivo[c.arquivo].total++;
    if (c.status !== 'passed') porArquivo[c.arquivo].falharam++;
  }
  return {
    executada: true,
    servidorIniciou: true,
    servidorCaiu: encerrado,
    repeticoes: rodadas.length,
    instaveis: casos.filter((c) => c.instavel).map((c) => c.nome),
    total: casos.length,
    passaram: casos.length - falhas.length,
    falharam: falhas.length,
    porArquivo,
    falhas,
  };
}

function contarTestesDeAceitacao() {
  // Conta casos declarados (test(...) e linhas de test.each) — usado quando a suíte não pode rodar.
  let n = 0;
  for (const f of readdirSync(join(KIT, 'aceitacao')).filter((f) => f.endsWith('.test.ts'))) {
    const t = readFileSync(join(KIT, 'aceitacao', f), 'utf8');
    n += (t.match(/^\s*test\(/gm) ?? []).length;
    for (const bloco of t.matchAll(/test\.each\(\[([\s\S]*?)\]\)\(/g)) n += (bloco[1].match(/^\s*\[/gm) ?? []).length;
  }
  return n;
}

function limparFalha(texto) {
  const linhas = semAnsi(texto)
    .split('\n')
    .filter((l) => !/^\s+at\s/.test(l) && !l.includes('node_modules'));
  return linhas.join('\n').trim().split('\n').slice(0, 14).join('\n');
}

// 7. métricas de código
function metricasDeCodigo() {
  const src = listarArquivos(join(PROJETO, 'src'), (c) => c.endsWith('.ts'));
  const ehTeste = (c) => /\.(spec|test|e2e-spec)\.ts$/.test(c);
  const codigo = src.filter((c) => !ehTeste(c));
  const testes = [...src.filter(ehTeste), ...listarArquivos(join(PROJETO, 'test'), (c) => ehTeste(c))];
  const textoCodigo = codigo.map((c) => readFileSync(c, 'utf8')).join('\n');
  const operadores = new Set();
  for (const imp of textoCodigo.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]rxjs(?:\/operators)?['"]/g)) {
    for (const nome of imp[1].split(',')) {
      const n = nome.replace(/\btype\b/, '').trim().split(/\s+as\s+/)[0];
      if (n) operadores.add(n);
    }
  }
  const contarCasos = (c) => (readFileSync(c, 'utf8').match(/^\s*(it|test)(\.each\([^)]*\))?\(/gm) ?? []).length;

  const pkg = JSON.parse(readFileSync(join(PROJETO, 'package.json'), 'utf8'));
  const referencia = JSON.parse(
    readFileSync(join(RAIZ, existsSync(join(PROJETO, 'AGENTS.md')) ? 'projetos/harness' : 'projetos/base', 'package.json'), 'utf8'),
  );
  const deps = (p) => new Set([...Object.keys(p.dependencies ?? {}), ...Object.keys(p.devDependencies ?? {})]);
  const antes = deps(referencia);
  return {
    arquivosCodigo: codigo.length,
    linhasCodigo: codigo.reduce((s, c) => s + linhasDeCodigo(c), 0),
    arquivosTeste: testes.length,
    casosDeTeste: testes.reduce((s, c) => s + contarCasos(c), 0),
    linhasTeste: testes.reduce((s, c) => s + linhasDeCodigo(c), 0),
    chamadasSubscribe: (textoCodigo.match(/\.subscribe\(/g) ?? []).length,
    importsRxjs: [...operadores].sort(),
    dependenciasAdicionadas: [...deps(pkg)].filter((d) => !antes.has(d)).sort(),
    dependenciasRemovidas: [...antes].filter((d) => !deps(pkg).has(d)).sort(),
  };
}

// 8. integridade do harness (grupo B): arquivos do harness alterados/removidos pelo agente
function integridadeDoHarness() {
  if (!existsSync(join(PROJETO, 'AGENTS.md')) && !existsSync(join(PROJETO, '.claude', 'settings.json'))) {
    return { aplicavel: false };
  }
  const origem = join(RAIZ, 'projetos/harness');
  const arquivos = listarArquivos(origem, () => true)
    .map((c) => relative(origem, c).split(sep).join('/'))
    .filter((c) => !['package.json', 'package-lock.json'].includes(c));
  const alterados = [];
  const removidos = [];
  for (const f of arquivos) {
    const destino = join(PROJETO, f);
    if (!existsSync(destino)) removidos.push(f);
    else if (hashArquivo(destino) !== hashArquivo(join(origem, f))) alterados.push(f);
  }
  return { aplicavel: true, arquivosVerificados: arquivos.length, alterados, removidos };
}

// ------------------------------------------------------------------ relatórios

function montarProblemas() {
  const testes = m.aceitacao.falharam ?? 0;
  const violacoes = m.arquitetura.total ?? 0;
  const build = m.build.ok ? 0 : 1;
  return { build, testesFalhando: testes, violacoes, total: build + testes + violacoes };
}

function relatorioMarkdown() {
  const a = m.aceitacao;
  const linhas = [
    `# Avaliação${ROTULO ? ` — ${ROTULO}` : ''}`,
    '',
    `- Avaliado em: ${m.avaliadoEm}`,
    `- Projeto: \`${m.projeto.caminho}\`${m.projeto.commit ? ` (commit \`${m.projeto.commit.slice(0, 10)}\`)` : ''}`,
    `- **Aprovado:** ${m.aprovado ? 'sim ✅' : 'não ❌'}`,
    '',
    '| Métrica | Valor |',
    '|---|---|',
    `| Build (\`npm run build\`) | ${m.build.ok ? 'ok' : '**falhou**'} |`,
    `| Erros de tipo (\`tsc --noEmit\`, inclui testes) | ${m.tipos.erros} |`,
    `| Testes de aceitação | ${a.passaram}/${a.total} passaram${a.executada ? '' : ` (não executados: ${a.motivo})`} |`,
    `| Violações arquiteturais (RX01–RX09) | ${m.arquitetura.total ?? 'erro'} |`,
    `| Lint genérico (oxlint, config da base) | ${m.lint.erros} erros, ${m.lint.avisos} avisos |`,
    `| Código | ${m.codigo.arquivosCodigo} arquivos, ${m.codigo.linhasCodigo} linhas |`,
    `| Testes escritos no projeto | ${m.codigo.arquivosTeste} arquivos, ${m.codigo.casosDeTeste} casos |`,
    `| Chamadas a \`.subscribe(\` | ${m.codigo.chamadasSubscribe} |`,
    `| Dependências adicionadas | ${m.codigo.dependenciasAdicionadas.join(', ') || '—'} |`,
  ];
  if (m.harness.aplicavel) {
    linhas.push(
      `| Arquivos do harness alterados/removidos | ${[...m.harness.alterados, ...m.harness.removidos.map((r) => `${r} (removido)`)].join(', ') || 'nenhum'} |`,
    );
  }
  const porRegra = Object.entries(m.arquitetura.porRegra ?? {}).filter(([, n]) => n > 0);
  if (porRegra.length > 0) {
    linhas.push('', '## Violações por regra', '', '| Regra | Ocorrências |', '|---|---|');
    for (const [r, n] of porRegra) linhas.push(`| ${r} | ${n} |`);
  }
  if (a.instaveis?.length > 0) {
    linhas.push('', `## Testes instáveis (falharam em parte das ${a.repeticoes} repetições)`, '', ...a.instaveis.map((n) => `- ${n}`));
  }
  if (a.porArquivo) {
    linhas.push('', '## Testes de aceitação por grupo', '', '| Arquivo | Falharam / total |', '|---|---|');
    for (const [arq, v] of Object.entries(a.porArquivo)) linhas.push(`| ${arq} | ${v.falharam}/${v.total} |`);
  }
  if (m.codigo.importsRxjs.length > 0) linhas.push('', `Imports de \`rxjs\`: ${m.codigo.importsRxjs.map((o) => `\`${o}\``).join(', ')}`);
  return `${linhas.join('\n')}\n`;
}

function promptDeIntervencao() {
  const partes = [
    'Revisei a implementação e encontrei os problemas abaixo. Corrija todos eles, mantendo os requisitos da tarefa original.',
  ];
  if (!m.build.ok) {
    partes.push('', '## Build', '', 'O comando `npm run build` falhou:', '', '```', m.build.saida, '```');
  } else if (m.aceitacao.servidorIniciou === false) {
    partes.push(
      '',
      '## Servidor',
      '',
      'O servidor não respondeu após `npm run build` e `npm run start:prod` (com a variável PORT definida). Saída do servidor:',
      '',
      '```',
      m.aceitacao.logServidor ?? '',
      '```',
    );
  }
  if (m.aceitacao.falhas?.length > 0) {
    partes.push('', `## Testes de aceitação que falharam (${m.aceitacao.falharam} de ${m.aceitacao.total})`, '');
    m.aceitacao.falhas.forEach((f, i) => {
      partes.push(`${i + 1}. **${f.nome}**${f.instavel ? ' (falha intermitente: falhou em parte das execuções)' : ''}`);
      if (f.mensagem) partes.push('', '   ```', ...f.mensagem.split('\n').map((l) => `   ${l}`), '   ```', '');
    });
  }
  const violacoes = m.arquitetura.violacoes ?? [];
  if (violacoes.length > 0) {
    partes.push(
      '',
      `## Violações das regras de arquitetura reativa (${violacoes.length})`,
      '',
      'O projeto deve seguir o paradigma reativo/orientado a eventos com RxJS. Estas ocorrências violam as regras:',
      '',
    );
    const porRegra = new Map();
    for (const v of violacoes) porRegra.set(v.regra, [...(porRegra.get(v.regra) ?? []), v]);
    for (const [regra, lista] of porRegra) {
      partes.push(`### ${regra} — ${lista[0].nome}`, '', `Problema: ${lista[0].descricao ?? lista[0].mensagem}`, '');
      for (const v of lista) partes.push(`- \`${v.arquivo}:${v.linha}\` — \`${v.trecho}\``);
      partes.push('', `Como corrigir: ${lista[0].comoCorrigir}`, '');
    }
  }
  return `${partes.join('\n').trim()}\n`;
}

// ------------------------------------------------------------------ principal

m.aceitacao = await aceitacao();
m.codigo = metricasDeCodigo();
m.harness = integridadeDoHarness();
m.problemas = montarProblemas();
m.aprovado = m.problemas.total === 0;

writeFileSync(join(SAIDA, 'metricas.json'), `${JSON.stringify(m, null, 2)}\n`);
writeFileSync(join(SAIDA, 'avaliacao.md'), relatorioMarkdown());
if (m.aprovado) rmSync(join(SAIDA, 'intervencao.md'), { force: true });
else writeFileSync(join(SAIDA, 'intervencao.md'), promptDeIntervencao());

console.log(
  `${m.aprovado ? '✅ APROVADO' : '❌ REPROVADO'} — build ${m.build.ok ? 'ok' : 'FALHOU'} | ` +
    `aceitação ${m.aceitacao.passaram}/${m.aceitacao.total} | violações ${m.arquitetura.total} | ` +
    `erros de tipo ${m.tipos.erros} | lint ${m.lint.erros}e/${m.lint.avisos}a`,
);
console.log(`Relatório: ${join(SAIDA, 'avaliacao.md')}`);
process.exit(0);
