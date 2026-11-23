#!/usr/bin/env node
// Condução das execuções do experimento (A = sem harness, B = com harness).
//
//   node scripts/experimento.mjs preparar   <ID> [--permitir-sujo] [--abrir]
//   node scripts/experimento.mjs checkpoint <ID> <entrega|correcao|humano> ["descrição"]
//   node scripts/experimento.mjs finalizar  <ID> [--manter-pasta] [--motivo "texto"]
//   node scripts/experimento.mjs status     [ID]
//   node scripts/experimento.mjs prompt     <ID>        (mostra de novo o último prompt de intervenção)
//
// IDs: A1..A3, B1..B3 (execuções reais) e ENSAIO-A / ENSAIO-B (ensaios do protocolo).
// Variáveis: EXECUCOES_DIR (padrão ~/projetos-leilao), MAX_RODADAS (8), MAX_MINUTOS (120).
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, release, type } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXECUCOES_DIR = process.env.EXECUCOES_DIR ?? join(homedir(), 'projetos-leilao');
const MAX_RODADAS = Number(process.env.MAX_RODADAS ?? 8);
const MAX_MINUTOS = Number(process.env.MAX_MINUTOS ?? 120);
const LINHA_DO_TEMPO = join(RAIZ, 'docs', 'linha-do-tempo.md');
const AUTOR_AGENTE = 'Agente de IA <agente@experimento.local>';

// ------------------------------------------------------------------ utilidades

const [comando, ID, ...resto] = process.argv.slice(2);
const flag = (nome) => resto.includes(nome);
const valorDe = (nome) => {
  const i = resto.indexOf(nome);
  return i >= 0 ? resto[i + 1] : undefined;
};

function falhar(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function sh(cmd, args, opcoes = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opcoes }).trim();
}

const git = (cwd, ...args) => sh('git', args, { cwd });
const tentar = (f, padrao = null) => {
  try {
    return f();
  } catch {
    return padrao;
  }
};

function validarId(id) {
  if (!id) falhar('informe o ID da execução (A1..A3, B1..B3, ENSAIO-A ou ENSAIO-B)');
  if (!/^(A[1-3]|B[1-3]|ENSAIO-[AB])$/.test(id)) falhar(`ID inválido: ${id}`);
}

const grupoDe = (id) => (id.startsWith('ENSAIO-') ? id.slice(-1) : id[0]);
const ehEnsaio = (id) => id.startsWith('ENSAIO-');
const dirExecucao = (id) => join(RAIZ, 'experimento', ehEnsaio(id) ? 'ensaio' : 'execucoes', id);
const ramoDe = (id) => `${ehEnsaio(id) ? 'ensaio' : 'execucoes'}/${id}`;
const arquivoEstado = (id) => join(dirExecucao(id), 'execucao.json');

const lerEstado = (id) => {
  if (!existsSync(arquivoEstado(id))) falhar(`execução ${id} não foi preparada (rode: scripts/preparar-execucao.sh ${id})`);
  return JSON.parse(readFileSync(arquivoEstado(id), 'utf8'));
};
const salvarEstado = (estado) => writeFileSync(arquivoEstado(estado.id), `${JSON.stringify(estado, null, 2)}\n`);

const agora = () => new Date();
const iso = (d = agora()) => d.toISOString();
const legivel = (d = agora()) =>
  d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const minutosDesde = (inicioIso) => Math.round((Date.now() - Date.parse(inicioIso)) / 60000);

function linhaDoTempo(id, texto) {
  const linha = `- **${legivel()}** — \`${id}\` ${texto}\n`;
  appendFileSync(join(dirExecucao(id), 'linha-do-tempo.md'), linha);
  if (!ehEnsaio(id)) appendFileSync(LINHA_DO_TEMPO, linha);
}

/** Commit no repositório principal apenas dos caminhos informados. */
function commitPrincipal(mensagem, caminhos) {
  const existentes = caminhos.filter((c) => existsSync(c));
  git(RAIZ, 'add', '--', ...existentes);
  const r = spawnSync('git', ['commit', '-q', '-m', mensagem, '--', ...existentes], { cwd: RAIZ, encoding: 'utf8' });
  if (r.status !== 0 && !/nothing to commit|nada para submeter/.test(`${r.stdout}${r.stderr}`)) {
    console.warn(`(aviso) commit no repositório principal falhou: ${r.stderr || r.stdout}`);
  }
}

function resumoAvaliacao(m) {
  return {
    aprovado: m.aprovado,
    build: m.build.ok,
    errosTipo: m.tipos.erros,
    testesTotal: m.aceitacao.total,
    testesFalhando: m.aceitacao.falharam,
    testesInstaveis: m.aceitacao.instaveis?.length ?? 0,
    servidorIniciou: m.aceitacao.servidorIniciou ?? null,
    violacoes: m.arquitetura.total,
    porRegra: Object.fromEntries(Object.entries(m.arquitetura.porRegra ?? {}).filter(([, n]) => n > 0)),
    lintErros: m.lint.erros,
    lintAvisos: m.lint.avisos,
    linhasCodigo: m.codigo.linhasCodigo,
    arquivosCodigo: m.codigo.arquivosCodigo,
    casosDeTesteDoProjeto: m.codigo.casosDeTeste,
    dependenciasAdicionadas: m.codigo.dependenciasAdicionadas,
    harnessAlterado: m.harness.aplicavel ? [...m.harness.alterados, ...m.harness.removidos] : null,
  };
}

const descreverProblemas = (r) =>
  r.aprovado
    ? 'aprovado (build ok, 0 testes falhando, 0 violações)'
    : `${r.build ? '' : 'build falhou, '}${r.testesFalhando}/${r.testesTotal} testes falhando, ${r.violacoes} violações`;

// ------------------------------------------------------------------ preparar

function preparar() {
  validarId(ID);
  if (existsSync(arquivoEstado(ID))) falhar(`a execução ${ID} já foi preparada (${relative(RAIZ, dirExecucao(ID))})`);
  const sujo = git(RAIZ, 'status', '--porcelain', '--untracked-files=no');
  if (sujo && !flag('--permitir-sujo')) {
    falhar(`o repositório principal tem alterações não commitadas:\n${sujo}\nFaça commit antes (o estado do harness/kit precisa estar registrado), ou use --permitir-sujo.`);
  }
  const grupo = grupoDe(ID);
  const variante = grupo === 'A' ? 'base' : 'harness';
  const pasta = join(EXECUCOES_DIR, ID);
  if (existsSync(pasta)) falhar(`a pasta de trabalho já existe: ${pasta}`);
  mkdirSync(EXECUCOES_DIR, { recursive: true });

  console.log(`→ Montando o projeto ${ID} (${variante}) em ${pasta} ...`);
  execFileSync('bash', [join(RAIZ, 'scripts/lib/montar-projeto.sh'), pasta, variante], { stdio: 'inherit' });
  git(pasta, 'add', '-A');
  git(pasta, 'commit', '-q', '-m', 'chore: estado inicial do projeto');
  const commitInicial = git(pasta, 'rev-parse', 'HEAD');

  const dir = dirExecucao(ID);
  mkdirSync(join(dir, 'checkpoints'), { recursive: true });
  const estado = {
    id: ID,
    grupo,
    condicao: grupo === 'A' ? 'sem harness' : 'com harness',
    variante,
    ensaio: ehEnsaio(ID),
    pasta,
    status: 'em-andamento',
    preparadaEm: iso(),
    finalizadaEm: null,
    repositorioPrincipal: { commit: git(RAIZ, 'rev-parse', 'HEAD'), sujo: Boolean(sujo) },
    ambiente: {
      node: process.version,
      npm: tentar(() => sh('npm', ['--version'])),
      claudeCli: tentar(() => sh('claude', ['--version'])),
      sistema: `${type()} ${release()}`,
    },
    limites: { maxRodadas: MAX_RODADAS, maxMinutos: MAX_MINUTOS },
    commitInicial,
    checkpoints: [],
    rodadasDeCorrecao: 0,
    edicoesManuais: 0,
  };
  salvarEstado(estado);
  const modelo = readFileSync(join(RAIZ, 'experimento/modelos/registro.md'), 'utf8')
    .replaceAll('{{ID}}', ID)
    .replaceAll('{{CONDICAO}}', estado.condicao)
    .replaceAll('{{PASTA}}', pasta)
    .replaceAll('{{DATA}}', legivel());
  writeFileSync(join(dir, 'registro.md'), modelo);
  writeFileSync(join(dir, 'linha-do-tempo.md'), `# Linha do tempo — execução ${ID} (${estado.condicao})\n\n`);
  linhaDoTempo(ID, `preparada (${estado.condicao}): pasta \`${pasta}\`, commit inicial \`${commitInicial.slice(0, 8)}\``);
  commitPrincipal(`exp(${ID}): execução preparada (${estado.condicao})`, [dir, LINHA_DO_TEMPO]);

  if (flag('--abrir')) tentar(() => spawnSync('code', ['-n', pasta], { stdio: 'ignore' }));
  console.log(`
✔ Execução ${ID} preparada (${estado.condicao}).

Próximos passos (detalhes em experimento/protocolo.md):
  1. Abra a pasta em uma NOVA janela do VS Code:   code -n ${pasta}
  2. Abra uma conversa NOVA do Claude Code nessa janela (mesmo modelo/esforço/modo de permissão de todas as execuções).
  3. Copie e cole como primeira mensagem o conteúdo de: experimento/prompts/tarefa.md
  4. Quando o agente terminar (e só então), registre a entrega:
       scripts/checkpoint.sh ${ID} entrega
`);
}

// ------------------------------------------------------------------ checkpoint

function checkpoint() {
  validarId(ID);
  const estado = lerEstado(ID);
  if (estado.status !== 'em-andamento') falhar(`a execução ${ID} já foi finalizada (${estado.status})`);
  const tipo = resto[0];
  const descricao = resto.slice(1).join(' ').trim();
  if (!['entrega', 'correcao', 'humano'].includes(tipo)) falhar('tipo deve ser: entrega, correcao ou humano');
  if (estado.checkpoints.length === 0 && tipo !== 'entrega') falhar('o primeiro checkpoint deve ser "entrega"');
  if (estado.checkpoints.length > 0 && tipo === 'entrega') falhar('a entrega inicial já foi registrada; use "correcao" ou "humano"');
  if (tipo === 'humano' && !descricao) falhar('descreva a edição manual: scripts/checkpoint.sh <ID> humano "o que foi alterado"');

  const n = estado.checkpoints.length + 1;
  const pasta = estado.pasta;
  if (!existsSync(pasta)) falhar(`pasta de trabalho não encontrada: ${pasta}`);

  let titulo;
  const trailers = [`Checkpoint: ${n}`, `Etapa: ${tipo}`];
  if (tipo === 'entrega') titulo = 'feat(agente): entrega inicial';
  if (tipo === 'correcao') {
    estado.rodadasDeCorrecao++;
    titulo = `fix(agente): correção após a intervenção ${estado.rodadasDeCorrecao}`;
    trailers.push(`Intervencao: ${estado.rodadasDeCorrecao}`);
  }
  if (tipo === 'humano') {
    estado.edicoesManuais++;
    titulo = `fix(humano): ${descricao}`;
    trailers.push(`Intervencao-manual: ${estado.edicoesManuais}`);
  }
  git(pasta, 'add', '-A');
  const argsCommit = ['commit', '-q', '--allow-empty', '-m', titulo, '-m', trailers.join('\n')];
  if (tipo !== 'humano') argsCommit.push(`--author=${AUTOR_AGENTE}`);
  git(pasta, ...argsCommit);
  const commit = git(pasta, 'rev-parse', 'HEAD');
  const arquivosAlterados = Number(
    tentar(() => git(pasta, 'diff', '--name-only', 'HEAD~1', 'HEAD').split('\n').filter(Boolean).length, 0),
  );

  const nomePasta = `${String(n).padStart(2, '0')}-${tipo}`;
  const saida = join(dirExecucao(ID), 'checkpoints', nomePasta);
  console.log(`→ Commit ${commit.slice(0, 8)} (${titulo}). Avaliando com o kit (≈30 s)...`);
  execFileSync(process.execPath, [join(RAIZ, 'avaliacao/avaliar.mjs'), '--projeto', pasta, '--saida', saida, '--rotulo', `${ID} — checkpoint ${n} (${tipo})`], {
    stdio: 'inherit',
  });
  const metricas = JSON.parse(readFileSync(join(saida, 'metricas.json'), 'utf8'));
  const r = resumoAvaliacao(metricas);
  estado.checkpoints.push({ n, tipo, descricao: descricao || null, commit, em: iso(), arquivosAlterados, pasta: `checkpoints/${nomePasta}`, ...r });
  salvarEstado(estado);
  linhaDoTempo(ID, `checkpoint ${n} (${tipo}${descricao ? `: ${descricao}` : ''}) — commit \`${commit.slice(0, 8)}\` — ${descreverProblemas(r)}`);

  const minutos = minutosDesde(estado.preparadaEm);
  let proximo;
  if (r.aprovado) {
    proximo = `✅ Critério de conclusão atingido. Finalize a execução:\n     scripts/finalizar-execucao.sh ${ID}`;
  } else if (estado.rodadasDeCorrecao >= MAX_RODADAS) {
    proximo = `⏹ Limite de ${MAX_RODADAS} rodadas de correção atingido. Finalize:\n     scripts/finalizar-execucao.sh ${ID}`;
  } else if (minutos >= MAX_MINUTOS) {
    proximo = `⏹ Limite de ${MAX_MINUTOS} minutos atingido (${minutos} min). Finalize:\n     scripts/finalizar-execucao.sh ${ID}`;
  } else {
    const arquivo = join(saida, 'intervencao.md');
    proximo = [
      `✍ Intervenção ${estado.rodadasDeCorrecao + 1}: cole no agente, como próxima mensagem, o conteúdo de:`,
      `     ${relative(RAIZ, arquivo)}`,
      `   Quando o agente terminar: scripts/checkpoint.sh ${ID} correcao`,
      '',
      '──────── início do prompt de intervenção ────────',
      readFileSync(arquivo, 'utf8').trimEnd(),
      '──────── fim do prompt de intervenção ────────',
    ].join('\n');
  }
  commitPrincipal(`exp(${ID}): checkpoint ${n} (${tipo}) — ${descreverProblemas(r)}`, [dirExecucao(ID), LINHA_DO_TEMPO]);
  console.log(`\n${ID} · checkpoint ${n} (${tipo}) · ${minutos} min desde a preparação · rodadas de correção: ${estado.rodadasDeCorrecao}\n${proximo}\n`);
}

// ------------------------------------------------------------------ finalizar

function pastaDeSessoes(pasta) {
  return join(homedir(), '.claude', 'projects', pasta.replace(/[^a-zA-Z0-9]/g, '-'));
}

function finalizar() {
  validarId(ID);
  const estado = lerEstado(ID);
  if (estado.status !== 'em-andamento') falhar(`a execução ${ID} já foi finalizada (${estado.status})`);
  if (estado.checkpoints.length === 0) falhar('nenhum checkpoint registrado; rode primeiro: scripts/checkpoint.sh <ID> entrega');
  const pasta = estado.pasta;
  const dir = dirExecucao(ID);
  const pendente = tentar(() => git(pasta, 'status', '--porcelain'), '');
  if (pendente) falhar(`há alterações não registradas em ${pasta}:\n${pendente}\nRode um checkpoint antes de finalizar.`);

  const ultimo = estado.checkpoints.at(-1);
  const motivo = valorDe('--motivo');
  estado.status = ultimo.aprovado
    ? 'aprovada'
    : motivo
      ? 'encerrada-manual'
      : estado.rodadasDeCorrecao >= MAX_RODADAS
        ? 'limite-rodadas'
        : 'limite-tempo';
  if (motivo) estado.motivoEncerramento = motivo;
  estado.finalizadaEm = iso();

  // 1. histórico git da execução -> ramo no repositório principal
  const ramo = ramoDe(ID);
  git(RAIZ, 'fetch', '-q', '--no-tags', pasta, `+refs/heads/main:refs/heads/${ramo}`);
  const cabeca = git(RAIZ, 'rev-parse', ramo);
  if (cabeca !== git(pasta, 'rev-parse', 'HEAD')) falhar('a importação do histórico não confere; nada foi apagado');
  const entrega = estado.checkpoints.find((c) => c.tipo === 'entrega');
  tentar(() => git(RAIZ, 'tag', '-f', `${ramo}/entrega`, entrega.commit));
  tentar(() => git(RAIZ, 'tag', '-f', `${ramo}/final`, cabeca));
  estado.ramo = ramo;

  // 2. transcrições do Claude Code e registro dos hooks
  const origemSessoes = pastaDeSessoes(pasta);
  const destinoSessoes = join(dir, 'sessao');
  if (existsSync(origemSessoes)) {
    cpSync(origemSessoes, destinoSessoes, { recursive: true });
    spawnSync(process.execPath, [join(RAIZ, 'scripts/analisar-sessao.mjs'), destinoSessoes, '--saida', join(dir, 'resumo-sessao.json')], {
      stdio: 'inherit',
    });
  } else {
    console.warn(`(aviso) transcrições não encontradas em ${origemSessoes}`);
  }
  const logHooks = join(pasta, '.harness', 'hooks.log');
  if (existsSync(logHooks)) cpSync(logHooks, join(dir, 'harness-hooks.log'));

  // 3. resumo da execução
  salvarEstado(estado);
  const resumo = resumir(estado);
  writeFileSync(join(dir, 'resumo.json'), `${JSON.stringify(resumo, null, 2)}\n`);
  writeFileSync(join(dir, 'resumo.md'), resumoMarkdown(resumo));
  linhaDoTempo(
    ID,
    `finalizada — **${estado.status}** após ${resumo.intervencoes.total} intervenção(ões) humana(s) e ${resumo.tempo.minutos ?? '?'} min; histórico no ramo \`${ramo}\``,
  );
  commitPrincipal(`exp(${ID}): execução finalizada — ${estado.status}, ${resumo.intervencoes.total} intervenção(ões)`, [dir, LINHA_DO_TEMPO]);

  // 4. remove a pasta de trabalho (o histórico já está no ramo e as sessões foram copiadas)
  if (!flag('--manter-pasta')) {
    rmSync(pasta, { recursive: true, force: true });
    console.log(`→ Pasta de trabalho removida (${pasta}); o código está no ramo ${ramo}.`);
  }
  console.log(`\n✔ Execução ${ID} finalizada: ${estado.status}.\n  Resumo: ${relative(RAIZ, join(dir, 'resumo.md'))}\n`);
}

function contarLinhas(texto, padrao) {
  return texto.split('\n').filter((l) => padrao.test(l)).length;
}

function resumir(estado) {
  const dir = dirExecucao(estado.id);
  const sessao = tentar(() => JSON.parse(readFileSync(join(dir, 'resumo-sessao.json'), 'utf8')));
  const hooks = tentar(() => readFileSync(join(dir, 'harness-hooks.log'), 'utf8'), '');
  const primeira = estado.checkpoints.find((c) => c.tipo === 'entrega');
  const final = estado.checkpoints.at(-1);
  const pick = (c) => ({
    build: c.build,
    errosTipo: c.errosTipo,
    testesFalhando: c.testesFalhando,
    testesTotal: c.testesTotal,
    testesInstaveis: c.testesInstaveis,
    violacoes: c.violacoes,
    porRegra: c.porRegra,
    lintErros: c.lintErros,
    linhasCodigo: c.linhasCodigo,
    casosDeTesteDoProjeto: c.casosDeTesteDoProjeto,
    dependenciasAdicionadas: c.dependenciasAdicionadas,
    harnessAlterado: c.harnessAlterado,
  });
  // Mensagens humanas na sessão = prompt inicial + prompts de intervenção + outras (esclarecimentos, "continue"...).
  // Se a execução foi conduzida por scripts/rodar-implementador.sh, cada mensagem enviada ao agente
  // está registrada em implementador/ — fonte exata (a transcrição pode registrar retornos de hooks
  // como mensagens de usuário).
  const mensagens = sessao?.mensagensHumanas ?? null;
  const dirImp = join(dir, 'implementador');
  const outras = existsSync(dirImp)
    ? readdirSync(dirImp).filter((f) => /^rodada-\d+-(pergunta|continuar)\.json$/.test(f)).length
    : mensagens === null
      ? null
      : Math.max(0, mensagens - 1 - estado.rodadasDeCorrecao);
  const inicio = sessao?.inicio ?? estado.preparadaEm;
  const fim = estado.checkpoints.at(-1).em;
  return {
    id: estado.id,
    grupo: estado.grupo,
    condicao: estado.condicao,
    status: estado.status,
    primeiraEntrega: pick(primeira),
    final: pick(final),
    evolucao: estado.checkpoints.map((c) => ({
      n: c.n,
      tipo: c.tipo,
      testesFalhando: c.testesFalhando,
      violacoes: c.violacoes,
      build: c.build,
      aprovado: c.aprovado,
    })),
    intervencoes: {
      promptsDeCorrecao: estado.rodadasDeCorrecao,
      edicoesManuais: estado.edicoesManuais,
      outrasMensagens: outras,
      total: estado.rodadasDeCorrecao + estado.edicoesManuais + (outras ?? 0),
    },
    tempo: {
      inicio,
      fim,
      minutos: Math.round((Date.parse(fim) - Date.parse(inicio)) / 60000),
    },
    sessao: sessao && {
      modelos: sessao.modelos,
      versoesClaudeCode: sessao.versoesClaudeCode,
      esforco: sessao.esforco,
      modosDePermissao: sessao.modosDePermissao,
      mensagensHumanas: sessao.mensagensHumanas,
      interrupcoes: sessao.interrupcoes,
      chamadasDeFerramenta: sessao.chamadasDeFerramenta,
      errosDeFerramenta: sessao.errosDeFerramenta,
      execucoes: sessao.execucoes,
      tokens: sessao.tokens,
    },
    harness:
      estado.grupo === 'B'
        ? {
            bloqueiosDoStop: contarLinhas(hooks, / stop bloqueado /),
            edicoesComViolacao: contarLinhas(hooks, / edicao violacoes /),
            edicoesVerificadas: contarLinhas(hooks, / edicao (ok|violacoes) /),
            validacoesOk: contarLinhas(hooks, / validate ok/),
            validacoesComFalha: contarLinhas(hooks, / validate falhou/),
          }
        : null,
  };
}

function resumoMarkdown(r) {
  const linha = (rotulo, a, b) => `| ${rotulo} | ${a} | ${b} |`;
  const p = r.primeiraEntrega;
  const f = r.final;
  const regras = (x) => Object.entries(x.porRegra ?? {}).map(([k, v]) => `${k}=${v}`).join(', ') || '—';
  const linhas = [
    `# Resumo da execução ${r.id} (${r.condicao})`,
    '',
    `- **Status:** ${r.status}`,
    `- **Intervenções humanas:** ${r.intervencoes.total} (prompts de correção: ${r.intervencoes.promptsDeCorrecao}; edições manuais: ${r.intervencoes.edicoesManuais}; outras mensagens: ${r.intervencoes.outrasMensagens ?? 'n/d'})`,
    `- **Tempo:** ${r.tempo.minutos} min`,
    '',
    '| Métrica | Primeira entrega | Final |',
    '|---|---|---|',
    linha('Build', p.build ? 'ok' : 'falhou', f.build ? 'ok' : 'falhou'),
    linha('Testes de aceitação falhando', `${p.testesFalhando}/${p.testesTotal}`, `${f.testesFalhando}/${f.testesTotal}`),
    linha('Violações arquiteturais', p.violacoes, f.violacoes),
    linha('Violações por regra', regras(p), regras(f)),
    linha('Erros de tipo', p.errosTipo, f.errosTipo),
    linha('Erros de lint', p.lintErros, f.lintErros),
    linha('Linhas de código', p.linhasCodigo, f.linhasCodigo),
    linha('Casos de teste escritos no projeto', p.casosDeTesteDoProjeto, f.casosDeTesteDoProjeto),
    '',
    '## Evolução por checkpoint',
    '',
    '| # | Tipo | Build | Testes falhando | Violações |',
    '|---|---|---|---|---|',
    ...r.evolucao.map((c) => `| ${c.n} | ${c.tipo} | ${c.build ? 'ok' : 'falhou'} | ${c.testesFalhando} | ${c.violacoes} |`),
  ];
  if (r.sessao) {
    linhas.push(
      '',
      '## Sessão do agente',
      '',
      `- Modelo: ${r.sessao.modelos?.join(', ')} · Claude Code ${r.sessao.versoesClaudeCode?.join(', ')} · esforço ${r.sessao.esforco?.join(', ') || 'n/d'}`,
      `- Mensagens humanas: ${r.sessao.mensagensHumanas} · interrupções: ${r.sessao.interrupcoes}`,
      `- Chamadas de ferramenta: ${r.sessao.chamadasDeFerramenta} (erros: ${r.sessao.errosDeFerramenta})`,
      `- Execuções: validate ${r.sessao.execucoes.validate}, testes ${r.sessao.execucoes.testes}, build ${r.sessao.execucoes.build}`,
      `- Tokens: saída ${r.sessao.tokens.saida}, entrada ${r.sessao.tokens.entrada}, cache lido ${r.sessao.tokens.cacheLeitura}`,
    );
  }
  if (r.harness) {
    linhas.push(
      '',
      '## Atuação do harness (hooks)',
      '',
      `- Edições verificadas pelo hook: ${r.harness.edicoesVerificadas} (com violação: ${r.harness.edicoesComViolacao})`,
      `- Encerramentos bloqueados pelo hook Stop: ${r.harness.bloqueiosDoStop}`,
      `- Validações completas: ${r.harness.validacoesOk} ok, ${r.harness.validacoesComFalha} com falha`,
    );
  }
  return `${linhas.join('\n')}\n`;
}

// ------------------------------------------------------------------ status e prompt

function status() {
  const ids = ID ? [ID] : ['A1', 'B1', 'B2', 'A2', 'A3', 'B3'];
  console.log('| Execução | Condição | Status | Checkpoints | Rodadas | Último resultado |');
  console.log('|---|---|---|---|---|---|');
  for (const id of ids) {
    if (!existsSync(arquivoEstado(id))) {
      console.log(`| ${id} | ${grupoDe(id) === 'A' ? 'sem harness' : 'com harness'} | não iniciada | — | — | — |`);
      continue;
    }
    const e = JSON.parse(readFileSync(arquivoEstado(id), 'utf8'));
    const u = e.checkpoints.at(-1);
    console.log(`| ${id} | ${e.condicao} | ${e.status} | ${e.checkpoints.length} | ${e.rodadasDeCorrecao} | ${u ? descreverProblemas(u) : '—'} |`);
  }
}

function prompt() {
  validarId(ID);
  const e = lerEstado(ID);
  const u = e.checkpoints.at(-1);
  if (!u) falhar('ainda não há checkpoints');
  const arq = join(dirExecucao(ID), u.pasta, 'intervencao.md');
  if (!existsSync(arq)) falhar('o último checkpoint foi aprovado: não há prompt de intervenção');
  console.log(readFileSync(arq, 'utf8'));
}

// ------------------------------------------------------------------ principal

const comandos = { preparar, checkpoint, finalizar, status, prompt };
if (!comandos[comando]) {
  console.log('uso: node scripts/experimento.mjs <preparar|checkpoint|finalizar|status|prompt> <ID> [...]');
  process.exit(2);
}
comandos[comando]();
