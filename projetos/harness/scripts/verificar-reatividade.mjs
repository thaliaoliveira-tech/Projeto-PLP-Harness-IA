#!/usr/bin/env node
// Verificador das regras de arquitetura reativa (RX01–RX09) — parte do harness.
//
// Uso:
//   node scripts/verificar-reatividade.mjs                 verifica src/ do projeto atual
//   node scripts/verificar-reatividade.mjs --json          saída em JSON (usada pelo kit de avaliação)
//   node scripts/verificar-reatividade.mjs --raiz <dir>    verifica outro projeto
//   node scripts/verificar-reatividade.mjs --hook          modo hook do Claude Code (PostToolUse):
//                                                          lê o JSON do stdin e verifica só o arquivo editado
//   node scripts/verificar-reatividade.mjs a.ts b.ts       verifica só os arquivos informados
//
// Saída: código 0 sem violações; 1 com violações (no modo --hook: 2, para o agente ver a mensagem).
// As regras estão documentadas em docs/regras-reativas.md.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ regras

export const REGRAS = {
  RX01: {
    nome: 'subscribe-aninhado',
    mensagem: 'subscribe() dentro de outro subscribe() ou dentro de um operador RxJS.',
    comoCorrigir:
      'Componha os fluxos com operadores de achatamento (switchMap, mergeMap, concatMap, exhaustMap) em vez de assinar um Observable dentro de outro.',
  },
  RX02: {
    nome: 'subscribe-fora-do-ciclo-de-vida',
    mensagem:
      'subscribe() fora do construtor/onModuleInit/onApplicationBootstrap (ou dentro de um controller).',
    comoCorrigir:
      'Controllers e métodos chamados por requisição devem DEVOLVER um Observable (o NestJS assina). Assinaturas permanentes (efeitos colaterais, projeções) ficam no onModuleInit, com takeUntil(destruir$) liberado no onModuleDestroy.',
  },
  RX03: {
    nome: 'subject-exposto',
    mensagem: 'Subject acessível fora da classe/módulo que o criou.',
    comoCorrigir:
      'Declare o Subject como "private readonly" e exponha apenas um Observable (ex.: readonly eventos$ = this.entrada$.asObservable()). Só o dono do Sink pode chamar next().',
  },
  RX04: {
    nome: 'estado-mutavel',
    mensagem: 'Estado mutado de forma imperativa (campo da classe ou variável de módulo).',
    comoCorrigir:
      'Não guarde estado em campos/variáveis alterados por métodos. Derive o estado do fluxo de eventos com scan()/reduce puros e exponha-o como Observable (ex.: estado$ = eventos$.pipe(scan(evoluir, inicial), shareReplay(1))).',
  },
  RX05: {
    nome: 'temporizador-imperativo',
    mensagem: 'Uso de setTimeout/setInterval/setImmediate (ou node:timers).',
    comoCorrigir:
      'Modele o tempo como fluxo: timer(), interval(), delay(), debounceTime()... Para reagendar um prazo que pode mudar, use switchMap(prazo => timer(prazo)).',
  },
  RX06: {
    nome: 'eventos-fora-do-rxjs',
    mensagem: 'Mecanismo de eventos que não é RxJS (EventEmitter, @nestjs/event-emitter, EventTarget...).',
    comoCorrigir:
      'Use Subjects/Observables do RxJS como barramento de eventos, para que todos os observadores possam compor os fluxos com operadores.',
  },
  RX07: {
    nome: 'emissor-conhece-observador',
    mensagem: 'O módulo de leilões/lances depende do módulo de notificações (o emissor chama o observador).',
    comoCorrigir:
      'Inverta a dependência: leilões apenas publicam eventos; notificações (e qualquer outro observador) assinam o fluxo de eventos de leilões. Quem muda não deve conhecer quem reage.',
  },
  RX08: {
    nome: 'acumulador-mutado',
    mensagem: 'O acumulador do scan() é mutado (redutor impuro).',
    comoCorrigir:
      'O redutor do scan() deve ser uma função pura: devolva um NOVO objeto/Map/array em vez de alterar o acumulador recebido.',
  },
  RX09: {
    nome: 'dependencia-circular',
    mensagem: 'Dependência circular entre arquivos.',
    comoCorrigir:
      'Quebre o ciclo extraindo os tipos/funções compartilhados para um arquivo que não importe nenhum dos dois (ex.: dominio/tipos.ts).',
  },
};

const SUBJECTS = new Set(['Subject', 'BehaviorSubject', 'ReplaySubject', 'AsyncSubject']);
const CICLO_DE_VIDA_SUBSCRIBE = new Set(['onModuleInit', 'onApplicationBootstrap']);
const CICLO_DE_VIDA_ESTADO = new Set([
  'onModuleInit',
  'onApplicationBootstrap',
  'onModuleDestroy',
  'beforeApplicationShutdown',
  'onApplicationShutdown',
]);
const MUTADORES = new Set([
  'set', 'delete', 'clear', 'push', 'pop', 'shift', 'unshift', 'splice',
  'sort', 'reverse', 'add', 'fill', 'copyWithin',
]);
const TEMPORIZADORES = new Set([
  'setTimeout', 'setInterval', 'setImmediate', 'clearTimeout', 'clearInterval', 'clearImmediate',
]);
const MODULOS_TEMPORIZADOR = new Set(['timers', 'node:timers', 'timers/promises', 'node:timers/promises']);
const MODULOS_EVENTOS = new Set([
  'events', 'node:events', '@nestjs/event-emitter', 'eventemitter2', 'eventemitter3', 'mitt',
]);
// Operadores/funções RxJS cujos callbacks não devem conter subscribe()
const OPERADORES = new Set([
  'map', 'tap', 'filter', 'mergeMap', 'switchMap', 'concatMap', 'exhaustMap', 'flatMap',
  'scan', 'reduce', 'mergeScan', 'switchScan', 'catchError', 'finalize', 'takeWhile',
  'skipWhile', 'first', 'last', 'find', 'every', 'distinctUntilChanged', 'debounce',
  'throttle', 'audit', 'defer', 'iif', 'groupBy',
]);
const PADRAO_EMISSOR = /(leil|lance|auction|bid)/i;
const PADRAO_OBSERVADOR = /notif/i;

// ------------------------------------------------------------------ utilidades

function carregarTypeScript(raiz) {
  const candidatos = [
    join(raiz, 'package.json'),
    join(process.cwd(), 'package.json'),
    fileURLToPath(import.meta.url),
  ];
  for (const c of candidatos) {
    try {
      return createRequire(c)('typescript');
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error('não foi possível carregar o pacote "typescript" (rode npm install)');
}

const ehArquivoDeTeste = (f) => /\.(spec|test|e2e-spec)\.ts$/.test(f) || f.endsWith('.d.ts');

function listarArquivos(dir) {
  if (!existsSync(dir)) return [];
  const saida = [];
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome.startsWith('.')) continue;
    const caminho = join(dir, nome);
    const st = statSync(caminho);
    if (st.isDirectory()) saida.push(...listarArquivos(caminho));
    else if (nome.endsWith('.ts') && !ehArquivoDeTeste(nome)) saida.push(caminho);
  }
  return saida.sort();
}

// ------------------------------------------------------------------ análise de um arquivo

function analisarArquivo(ts, caminhoAbs, raiz) {
  const texto = readFileSync(caminhoAbs, 'utf8');
  const sf = ts.createSourceFile(caminhoAbs, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const arquivo = relative(raiz, caminhoAbs).split(sep).join('/');
  const violacoes = [];
  const imports = [];

  const registrar = (regra, no, detalhe) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(no.getStart(sf));
    const trecho = texto.slice(no.getStart(sf), no.getEnd()).split('\n')[0].trim().slice(0, 120);
    violacoes.push({
      regra,
      nome: REGRAS[regra].nome,
      arquivo,
      linha: line + 1,
      coluna: character + 1,
      trecho,
      mensagem: detalhe ? `${REGRAS[regra].mensagem} ${detalhe}` : REGRAS[regra].mensagem,
      comoCorrigir: REGRAS[regra].comoCorrigir,
    });
  };

  const ehFuncao = (n) =>
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n);

  const funcaoEnvolvente = (n) => {
    for (let p = n.parent; p; p = p.parent) if (ehFuncao(p)) return p;
    return undefined;
  };

  /** Membro de classe mais próximo (método, construtor, propriedade) que contém o nó. */
  const membroDeClasse = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (
        (ts.isMethodDeclaration(p) || ts.isConstructorDeclaration(p) || ts.isPropertyDeclaration(p) ||
          ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p)) &&
        p.parent && (ts.isClassDeclaration(p.parent) || ts.isClassExpression(p.parent))
      ) {
        return p;
      }
    }
    return undefined;
  };

  const nomeDoMembro = (m) => (m && m.name && ts.isIdentifier(m.name) ? m.name.text : undefined);

  const classeEhController = (classe) =>
    (ts.canHaveDecorators?.(classe) ? ts.getDecorators(classe) ?? [] : []).some((d) => {
      const e = d.expression;
      const nome = ts.isCallExpression(e) ? e.expression : e;
      return ts.isIdentifier(nome) && nome.text === 'Controller';
    });

  const temModificador = (n, kind) =>
    (ts.canHaveModifiers?.(n) ? ts.getModifiers(n) ?? [] : []).some((m) => m.kind === kind);

  const ehPrivado = (n) =>
    temModificador(n, ts.SyntaxKind.PrivateKeyword) ||
    temModificador(n, ts.SyntaxKind.ProtectedKeyword) ||
    (n.name && ts.isPrivateIdentifier(n.name));

  const nomeDeTipo = (tipo) => {
    if (!tipo) return undefined;
    if (ts.isTypeReferenceNode(tipo)) {
      const n = tipo.typeName;
      return ts.isIdentifier(n) ? n.text : n.right.text;
    }
    return undefined;
  };

  const novoSubject = (expr) =>
    expr && ts.isNewExpression(expr) && ts.isIdentifier(expr.expression) && SUBJECTS.has(expr.expression.text);

  /** Raiz de uma cadeia a.b[c].d -> identificador "a" ou this. */
  const raizDoAlvo = (expr) => {
    let e = expr;
    for (;;) {
      if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) e = e.expression;
      else if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) e = e.expression;
      else break;
    }
    return e;
  };

  const ehAtribuicao = (n) =>
    ts.isBinaryExpression(n) &&
    n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    n.operatorToken.kind <= ts.SyntaxKind.LastAssignment;

  /** Se o nó é uma mutação, devolve a expressão-alvo (o que está sendo mutado). */
  const alvoDaMutacao = (n) => {
    if (ehAtribuicao(n)) return n.left;
    if (
      (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
      (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      return n.operand;
    }
    if (ts.isDeleteExpression(n)) return n.expression;
    if (
      ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
      MUTADORES.has(n.expression.name.text)
    ) {
      return n.expression.expression;
    }
    return undefined;
  };

  // Variáveis declaradas no nível do módulo (candidatas a estado global mutável).
  const variaveisDeModulo = new Set();
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) variaveisDeModulo.add(d.name.text);
      }
    }
  }

  /** true se `nome` é declarado (parâmetro/variável) em alguma função que envolve o nó. */
  const declaradoLocalmente = (no, nome) => {
    for (let f = funcaoEnvolvente(no); f; f = funcaoEnvolvente(f)) {
      if (f.parameters?.some((p) => ts.isIdentifier(p.name) && p.name.text === nome)) return true;
      let achou = false;
      const procurar = (n) => {
        if (achou) return;
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nome) achou = true;
        else ts.forEachChild(n, procurar);
      };
      if (f.body) procurar(f.body);
      if (achou) return true;
    }
    return false;
  };

  const ehChamadaSubscribe = (n) =>
    ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
    n.expression.name.text === 'subscribe';

  const visitar = (n) => {
    // ---------------- imports (RX05, RX06, grafo para RX07/RX09)
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const mod = n.moduleSpecifier.text;
      const somenteTipo = Boolean(n.importClause?.isTypeOnly);
      imports.push({ mod, somenteTipo, no: n });
      if (MODULOS_TEMPORIZADOR.has(mod)) registrar('RX05', n, `(import de "${mod}")`);
      if (MODULOS_EVENTOS.has(mod)) registrar('RX06', n, `(import de "${mod}")`);
    }

    // ---------------- RX06: new EventTarget()
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'EventTarget') {
      registrar('RX06', n);
    }

    // ---------------- RX05: temporizadores
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const nome = ts.isIdentifier(c)
        ? c.text
        : ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) &&
            ['global', 'globalThis', 'window'].includes(c.expression.text)
          ? c.name.text
          : undefined;
      if (nome && TEMPORIZADORES.has(nome)) registrar('RX05', n);
    }

    // ---------------- RX01 / RX02: subscribe
    if (ehChamadaSubscribe(n)) {
      // RX01: subscribe dentro de argumento de outro subscribe ou de operador
      let filho = n;
      for (let p = n.parent; p && !ts.isSourceFile(p); filho = p, p = p.parent) {
        if (ts.isCallExpression(p) && p !== n && p.arguments.includes(filho)) {
          const ehOperador = ts.isIdentifier(p.expression) && OPERADORES.has(p.expression.text);
          if (ehOperador || ehChamadaSubscribe(p)) {
            registrar('RX01', n);
            break;
          }
        }
      }
      // RX02: só no construtor / onModuleInit / onApplicationBootstrap / inicialização de campo
      const membro = membroDeClasse(n);
      const classe = membro?.parent;
      if (!membro) {
        registrar('RX02', n, '(fora de qualquer classe)');
      } else if (classe && (classeEhController(classe) || arquivo.endsWith('.controller.ts'))) {
        registrar('RX02', n, '(dentro de controller)');
      } else if (
        !ts.isConstructorDeclaration(membro) &&
        !ts.isPropertyDeclaration(membro) &&
        !CICLO_DE_VIDA_SUBSCRIBE.has(nomeDoMembro(membro))
      ) {
        registrar('RX02', n, `(no método "${nomeDoMembro(membro) ?? '?'}")`);
      }
    }

    // ---------------- RX03: Subjects expostos
    if (ts.isPropertyDeclaration(n) && n.parent && (ts.isClassDeclaration(n.parent) || ts.isClassExpression(n.parent))) {
      const ehSubject = novoSubject(n.initializer) || SUBJECTS.has(nomeDeTipo(n.type));
      if (ehSubject && !ehPrivado(n)) registrar('RX03', n);
    }
    if (ts.isParameter(n) && n.parent && ts.isConstructorDeclaration(n.parent)) {
      const ehPropriedade =
        temModificador(n, ts.SyntaxKind.PublicKeyword) || temModificador(n, ts.SyntaxKind.ReadonlyKeyword);
      if (ehPropriedade && !ehPrivado(n) && SUBJECTS.has(nomeDeTipo(n.type))) registrar('RX03', n);
    }
    if (
      (ts.isMethodDeclaration(n) || ts.isGetAccessorDeclaration(n)) && !ehPrivado(n) &&
      SUBJECTS.has(nomeDeTipo(n.type))
    ) {
      registrar('RX03', n, '(método/getter público devolve o Subject)');
    }
    if (ts.isVariableStatement(n) && ts.isSourceFile(n.parent) && temModificador(n, ts.SyntaxKind.ExportKeyword)) {
      for (const d of n.declarationList.declarations) {
        if (novoSubject(d.initializer) || SUBJECTS.has(nomeDeTipo(d.type))) registrar('RX03', d, '(exportado pelo módulo)');
      }
    }

    // ---------------- RX04 / RX08: mutações
    const alvo = alvoDaMutacao(n);
    if (alvo) {
      const raizAlvo = raizDoAlvo(alvo);
      const funcao = funcaoEnvolvente(n);
      if (raizAlvo.kind === ts.SyntaxKind.ThisKeyword && alvo !== raizAlvo) {
        const permitido =
          funcao && (ts.isConstructorDeclaration(funcao) ||
            (ts.isMethodDeclaration(funcao) && CICLO_DE_VIDA_ESTADO.has(nomeDoMembro(funcao))));
        if (!permitido) registrar('RX04', n, '(campo da classe)');
      } else if (
        ts.isIdentifier(raizAlvo) && funcao && variaveisDeModulo.has(raizAlvo.text) &&
        !declaradoLocalmente(n, raizAlvo.text)
      ) {
        registrar('RX04', n, `(variável de módulo "${raizAlvo.text}")`);
      }
    }
    if (
      ts.isCallExpression(n) && ts.isIdentifier(n.expression) &&
      (n.expression.text === 'scan' || n.expression.text === 'mergeScan')
    ) {
      const redutor = n.arguments[0];
      if (redutor && (ts.isArrowFunction(redutor) || ts.isFunctionExpression(redutor))) {
        const p0 = redutor.parameters[0];
        if (p0 && ts.isIdentifier(p0.name)) {
          const acc = p0.name.text;
          const procurar = (m) => {
            const a = alvoDaMutacao(m);
            if (a) {
              const r = raizDoAlvo(a);
              if (ts.isIdentifier(r) && r.text === acc && (a !== r || ehAtribuicao(m) === false)) {
                registrar('RX08', m);
              }
            }
            ts.forEachChild(m, procurar);
          };
          procurar(redutor.body);
        }
      }
    }

    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  // ---------------- RX07: emissor (leilões/lances) importando observador (notificações)
  const caminhoNoSrc = arquivo.replace(/^src\//, '');
  if (PADRAO_EMISSOR.test(caminhoNoSrc) && !PADRAO_OBSERVADOR.test(caminhoNoSrc)) {
    for (const imp of imports) {
      if (PADRAO_OBSERVADOR.test(imp.mod) && imp.mod.startsWith('.')) {
        registrar('RX07', imp.no, `(import de "${imp.mod}")`);
      }
    }
  }

  return { arquivo, violacoes, imports };
}

// ------------------------------------------------------------------ RX09: ciclos

function resolverImport(deArquivoAbs, mod, conhecidos) {
  if (!mod.startsWith('.')) return undefined;
  const base = resolve(dirname(deArquivoAbs), mod);
  const candidatos = [
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.mjs$/, '.mts'),
    base,
    `${base}.ts`,
    join(base, 'index.ts'),
  ];
  return candidatos.find((c) => conhecidos.has(c));
}

function encontrarCiclos(grafo) {
  // Tarjan: componentes fortemente conexos com mais de um nó (ou laço próprio)
  let indice = 0;
  const pilha = [];
  const naPilha = new Set();
  const idx = new Map();
  const low = new Map();
  const ciclos = [];
  const visitar = (v) => {
    idx.set(v, indice);
    low.set(v, indice);
    indice++;
    pilha.push(v);
    naPilha.add(v);
    for (const w of grafo.get(v) ?? []) {
      if (!idx.has(w)) {
        visitar(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (naPilha.has(w)) {
        low.set(v, Math.min(low.get(v), idx.get(w)));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp = [];
      let w;
      do {
        w = pilha.pop();
        naPilha.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1 || (grafo.get(v) ?? new Set()).has(v)) ciclos.push(comp.sort());
    }
  };
  for (const v of grafo.keys()) if (!idx.has(v)) visitar(v);
  return ciclos;
}

// ------------------------------------------------------------------ API

/**
 * Verifica um projeto. `arquivos` (opcional) restringe as regras por arquivo;
 * o ciclo (RX09) só é verificado quando o projeto inteiro é analisado.
 */
export function verificar({ raiz = process.cwd(), arquivos } = {}) {
  const raizAbs = resolve(raiz);
  const ts = carregarTypeScript(raizAbs);
  const todos = listarArquivos(join(raizAbs, 'src'));
  const alvos = arquivos ? arquivos.map((a) => resolve(raizAbs, a)).filter((a) => existsSync(a)) : todos;
  const resultados = alvos.map((a) => analisarArquivo(ts, a, raizAbs));
  const violacoes = resultados.flatMap((r) => r.violacoes);

  if (!arquivos) {
    const conhecidos = new Set(todos);
    const grafo = new Map();
    for (const [i, r] of resultados.entries()) {
      const de = alvos[i];
      const destinos = new Set();
      for (const imp of r.imports) {
        if (imp.somenteTipo) continue;
        const para = resolverImport(de, imp.mod, conhecidos);
        if (para) destinos.add(para);
      }
      grafo.set(de, destinos);
    }
    for (const ciclo of encontrarCiclos(grafo)) {
      const nomes = ciclo.map((c) => relative(raizAbs, c).split(sep).join('/'));
      violacoes.push({
        regra: 'RX09',
        nome: REGRAS.RX09.nome,
        arquivo: nomes[0],
        linha: 1,
        coluna: 1,
        trecho: nomes.join(' ⇄ '),
        mensagem: `${REGRAS.RX09.mensagem} (${nomes.join(' ⇄ ')})`,
        comoCorrigir: REGRAS.RX09.comoCorrigir,
      });
    }
  }

  const porRegra = Object.fromEntries(Object.keys(REGRAS).map((r) => [r, 0]));
  for (const v of violacoes) porRegra[v.regra]++;
  return { arquivosAnalisados: alvos.length, total: violacoes.length, porRegra, violacoes };
}

export function formatar(resultado) {
  const linhas = [];
  for (const v of resultado.violacoes) {
    linhas.push(`✖ ${v.regra} ${v.nome}  ${v.arquivo}:${v.linha}:${v.coluna}`);
    linhas.push(`    ${v.trecho}`);
    linhas.push(`    ${v.mensagem}`);
    linhas.push(`    Como corrigir: ${v.comoCorrigir}`);
    linhas.push('');
  }
  const resumo = Object.entries(resultado.porRegra)
    .filter(([, n]) => n > 0)
    .map(([r, n]) => `${r}=${n}`)
    .join(', ');
  linhas.push(
    resultado.total === 0
      ? `✔ Regras reativas: nenhuma violação em ${resultado.arquivosAnalisados} arquivo(s).`
      : `✖ Regras reativas: ${resultado.total} violação(ões) [${resumo}]. Detalhes das regras: docs/regras-reativas.md`,
  );
  return linhas.join('\n');
}

// ------------------------------------------------------------------ linha de comando

/** Registro local dos hooks (.harness/hooks.log), usado como evidência no experimento. */
function registrarNoLog(raiz, texto) {
  try {
    const dir = join(raiz, '.harness');
    mkdirSync(dir, { recursive: true });
    const d = new Date();
    const off = -d.getTimezoneOffset();
    const sinal = off >= 0 ? '+' : '-';
    const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
    const mm = String(Math.abs(off) % 60).padStart(2, '0');
    const local = new Date(d.getTime() + off * 60_000).toISOString().slice(0, 19);
    appendFileSync(join(dir, 'hooks.log'), `${local}${sinal}${hh}${mm} ${texto}\n`);
  } catch {
    /* o registro nunca deve quebrar o hook */
  }
}

async function lerStdin() {
  const partes = [];
  for await (const p of process.stdin) partes.push(p);
  return Buffer.concat(partes).toString('utf8');
}

async function principal() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const hook = args.includes('--hook');
  const iRaiz = args.indexOf('--raiz');
  let raiz = iRaiz >= 0 ? args[iRaiz + 1] : process.cwd();
  const arquivos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--raiz');

  if (hook) {
    // Hook PostToolUse do Claude Code: {"tool_input": {"file_path": "..."}, "cwd": "..."}
    let entrada = {};
    try {
      entrada = JSON.parse(await lerStdin());
    } catch {
      process.exit(0);
    }
    raiz = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || raiz;
    const arquivo = entrada.tool_input?.file_path;
    if (!arquivo || !arquivo.endsWith('.ts') || ehArquivoDeTeste(arquivo)) process.exit(0);
    const rel = relative(resolve(raiz), resolve(raiz, arquivo));
    if (!rel.startsWith(`src${sep}`)) process.exit(0);
    const r = verificar({ raiz, arquivos: [rel] });
    registrarNoLog(raiz, `edicao ${r.total > 0 ? 'violacoes' : 'ok'} ${rel.split(sep).join('/')} ${r.total}`);
    if (r.total > 0) {
      process.stderr.write(`[harness] O arquivo editado viola regras reativas do projeto:\n\n${formatar(r)}\n`);
      process.exit(2);
    }
    process.exit(0);
  }

  const r = verificar({ raiz, arquivos: arquivos.length > 0 ? arquivos : undefined });
  process.stdout.write(json ? `${JSON.stringify(r, null, 2)}\n` : `${formatar(r)}\n`);
  process.exit(r.total > 0 ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => {
    process.stderr.write(`erro no verificador: ${e?.stack ?? e}\n`);
    process.exit(3);
  });
}
