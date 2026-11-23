#!/usr/bin/env node
// Analisa as transcrições (.jsonl) de sessões do Claude Code e resume o processo de uma execução.
//
// Uso: node scripts/analisar-sessao.mjs <pasta-ou-arquivos.jsonl...> [--saida resumo.json]
//
// O formato das transcrições é interno ao Claude Code e pode mudar entre versões; o analisador é
// tolerante: campos ausentes viram null e nada aqui interrompe a finalização de uma execução.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const iSaida = args.indexOf('--saida');
const saida = iSaida >= 0 ? args[iSaida + 1] : undefined;
const entradas = args.filter((a, i) => a !== '--saida' && args[i - 1] !== '--saida');

function coletar(caminho) {
  if (!existsSync(caminho)) return [];
  if (statSync(caminho).isDirectory()) {
    return readdirSync(caminho).flatMap((n) => coletar(join(caminho, n)));
  }
  return caminho.endsWith('.jsonl') ? [caminho] : [];
}

const arquivos = entradas.flatMap(coletar).sort();
const registros = [];
for (const arquivo of arquivos) {
  for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
    if (!linha.trim()) continue;
    try {
      registros.push({ ...JSON.parse(linha), __arquivo: arquivo });
    } catch {
      /* linha corrompida: ignora */
    }
  }
}

const textoDe = (conteudo) =>
  typeof conteudo === 'string'
    ? conteudo
    : Array.isArray(conteudo)
      ? conteudo.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('\n')
      : '';

const ehResultadoDeFerramenta = (conteudo) =>
  Array.isArray(conteudo) && conteudo.some((b) => b?.type === 'tool_result');

const sessoes = new Set();
const modelos = new Set();
const versoes = new Set();
const pontosDeEntrada = new Set();
const modosDePermissao = new Set();
const esforcos = new Set();
const mensagensHumanas = [];
const interrupcoes = [];
const ferramentas = {};
const errosDeFerramenta = [];
const comandosBash = [];
const usoPorMensagem = new Map();
let primeiro = null;
let ultimo = null;
let entradasDeSubagente = 0;

for (const r of registros) {
  if (r.sessionId) sessoes.add(r.sessionId);
  if (r.timestamp) {
    if (!primeiro || r.timestamp < primeiro) primeiro = r.timestamp;
    if (!ultimo || r.timestamp > ultimo) ultimo = r.timestamp;
  }
  if (r.isSidechain) entradasDeSubagente++;
  if (r.version) versoes.add(r.version);
  if (r.entrypoint) pontosDeEntrada.add(r.entrypoint);
  if (r.permissionMode) modosDePermissao.add(r.permissionMode);

  if (r.type === 'user' && r.message && !r.isSidechain) {
    const c = r.message.content;
    if (ehResultadoDeFerramenta(c)) {
      for (const b of c) {
        if (b?.type === 'tool_result' && b.is_error) {
          errosDeFerramenta.push({ quando: r.timestamp, trecho: textoDe(b.content).slice(0, 300) });
        }
      }
      continue;
    }
    const texto = textoDe(c);
    if (texto.startsWith('[Request interrupted')) {
      interrupcoes.push({ quando: r.timestamp });
      continue;
    }
    const humano = r.origin?.kind === 'human' || (r.origin === undefined && r.userType === 'external' && !r.isMeta);
    if (humano && !r.isMeta && !r.isCompactSummary) {
      mensagensHumanas.push({ quando: r.timestamp, caracteres: texto.length, inicio: texto.slice(0, 160) });
    }
  }

  if (r.type === 'assistant' && r.message) {
    const m = r.message;
    if (r.requestedModel) modelos.add(r.requestedModel);
    else if (m.model) modelos.add(m.model);
    if (r.effort) esforcos.add(r.effort);
    if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b?.type !== 'tool_use') continue;
        ferramentas[b.name] = (ferramentas[b.name] ?? 0) + 1;
        if (b.name === 'Bash' && typeof b.input?.command === 'string') {
          comandosBash.push(b.input.command.slice(0, 200));
        }
      }
    }
    // O mesmo id de mensagem pode aparecer em várias linhas (um bloco por linha): guarda o último uso.
    if (m.usage) usoPorMensagem.set(m.id ?? `${r.uuid}`, m.usage);
  }
}

const tokens = { entrada: 0, saida: 0, cacheEscrita: 0, cacheLeitura: 0 };
for (const u of usoPorMensagem.values()) {
  tokens.entrada += u.input_tokens ?? 0;
  tokens.saida += u.output_tokens ?? 0;
  tokens.cacheEscrita += u.cache_creation_input_tokens ?? 0;
  tokens.cacheLeitura += u.cache_read_input_tokens ?? 0;
}

const conta = (padrao) => comandosBash.filter((c) => padrao.test(c)).length;
const resumo = {
  arquivos: arquivos.length,
  sessoes: [...sessoes],
  modelos: [...modelos],
  versoesClaudeCode: [...versoes],
  pontosDeEntrada: [...pontosDeEntrada],
  modosDePermissao: [...modosDePermissao],
  esforco: [...esforcos],
  inicio: primeiro,
  fim: ultimo,
  duracaoMinutos: primeiro && ultimo ? Math.round((Date.parse(ultimo) - Date.parse(primeiro)) / 600) / 100 : null,
  mensagensHumanas: mensagensHumanas.length,
  detalheMensagensHumanas: mensagensHumanas,
  interrupcoes: interrupcoes.length,
  chamadasDeFerramenta: Object.values(ferramentas).reduce((s, n) => s + n, 0),
  ferramentas,
  errosDeFerramenta: errosDeFerramenta.length,
  detalheErrosDeFerramenta: errosDeFerramenta.slice(0, 50),
  comandosBash: comandosBash.length,
  execucoes: {
    validate: conta(/npm run validate|scripts\/validar\.sh/),
    testes: conta(/npm (run )?test|vitest/),
    build: conta(/npm run build|nest build/),
    tsc: conta(/\btsc\b/),
  },
  respostasDoModelo: usoPorMensagem.size,
  tokens,
  entradasDeSubagente,
};

const json = `${JSON.stringify(resumo, null, 2)}\n`;
if (saida) writeFileSync(saida, json);
else process.stdout.write(json);
