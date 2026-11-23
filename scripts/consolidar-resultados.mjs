#!/usr/bin/env node
// Consolida os resultados das execuções (A1–A3 sem harness, B1–B3 com harness).
//
// Uso: node scripts/consolidar-resultados.mjs [--ensaio]
//   lê   experimento/execucoes/<ID>/resumo.json   (ou experimento/ensaio/ com --ensaio)
//   gera experimento/resultados/resultados.csv, resultados.md e graficos/*.svg
//
// Estatística: com n = 3 por condição a análise é DESCRITIVA (média, desvio-padrão amostral,
// mediana, mínimo–máximo) e o tamanho de efeito é o delta de Cliff; não há teste de hipótese.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENSAIO = process.argv.includes('--ensaio');
const ORIGEM = join(RAIZ, 'experimento', ENSAIO ? 'ensaio' : 'execucoes');
const DESTINO = join(RAIZ, 'experimento', ENSAIO ? 'ensaio/resultados' : 'resultados');
const IDS = ENSAIO ? ['ENSAIO-A', 'ENSAIO-B'] : ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
const NOME = { A: 'Sem harness (A)', B: 'Com harness (B)' };

// ------------------------------------------------------------------ dados

const execucoes = IDS.map((id) => {
  const arq = join(ORIGEM, id, 'resumo.json');
  return existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : { id, grupo: id.at(-1) === 'A' || id.startsWith('A') ? 'A' : 'B', ausente: true };
}).map((e) => ({ ...e, grupo: e.grupo ?? (e.id.startsWith('A') || e.id.endsWith('-A') ? 'A' : 'B') }));

const problemas = (c) => (c ? c.testesFalhando + c.violacoes + (c.build ? 0 : 1) : null);

/** Métricas comparadas (chave, rótulo, extrator, se "menor é melhor"). */
const METRICAS = [
  ['testes1', 'Testes de aceitação falhando na 1ª entrega', (e) => e.primeiraEntrega?.testesFalhando],
  ['violacoes1', 'Violações arquiteturais na 1ª entrega', (e) => e.primeiraEntrega?.violacoes],
  ['problemas1', 'Problemas na 1ª entrega (build + testes + violações)', (e) => problemas(e.primeiraEntrega)],
  ['tipos1', 'Erros de tipo na 1ª entrega', (e) => e.primeiraEntrega?.errosTipo],
  ['intervencoes', 'Intervenções humanas (total)', (e) => e.intervencoes?.total],
  ['rodadas', 'Rodadas de correção (prompts de intervenção)', (e) => e.intervencoes?.promptsDeCorrecao],
  ['manuais', 'Edições manuais', (e) => e.intervencoes?.edicoesManuais],
  ['outras', 'Outras mensagens humanas', (e) => e.intervencoes?.outrasMensagens],
  ['minutos', 'Tempo até o fim (min)', (e) => e.tempo?.minutos],
  ['testesF', 'Testes falhando no final', (e) => e.final?.testesFalhando],
  ['violacoesF', 'Violações no final', (e) => e.final?.violacoes],
  ['ferramentas', 'Chamadas de ferramenta do agente', (e) => e.sessao?.chamadasDeFerramenta],
  ['errosFerramenta', 'Erros de ferramenta do agente', (e) => e.sessao?.errosDeFerramenta],
  ['tokensSaida', 'Tokens de saída do modelo', (e) => e.sessao?.tokens?.saida],
  ['linhas', 'Linhas de código (final)', (e) => e.final?.linhasCodigo],
  ['casosTeste', 'Casos de teste escritos pelo agente (final)', (e) => e.final?.casosDeTesteDoProjeto],
];

const valor = (e, chave) => {
  if (e.ausente) return null;
  const v = METRICAS.find(([k]) => k === chave)[2](e);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

// ------------------------------------------------------------------ estatística descritiva

const media = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const desvio = (xs) => {
  if (xs.length < 2) return null;
  const m = media(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
const mediana = (xs) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2;
};
/** Delta de Cliff: P(A > B) − P(A < B). Positivo = valores de A maiores. */
const cliff = (as, bs) => {
  if (!as.length || !bs.length) return null;
  let s = 0;
  for (const a of as) for (const b of bs) s += Math.sign(a - b);
  return s / (as.length * bs.length);
};
const magnitudeCliff = (d) => {
  if (d === null) return '—';
  const x = Math.abs(d);
  return x < 0.147 ? 'desprezível' : x < 0.33 ? 'pequeno' : x < 0.474 ? 'médio' : 'grande';
};

const num = (v, casas = 1) =>
  v === null || v === undefined
    ? '—'
    : (Number.isInteger(v) && casas <= 1
        ? v.toLocaleString('pt-BR')
        : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas })
      ).replace(/^-/, '−');

function estatisticas(chave) {
  const doGrupo = (g) => execucoes.filter((e) => e.grupo === g).map((e) => valor(e, chave)).filter((v) => v !== null);
  const a = doGrupo('A');
  const b = doGrupo('B');
  const ma = media(a);
  const mb = media(b);
  return {
    a: { n: a.length, media: ma, desvio: desvio(a), mediana: mediana(a), min: a.length ? Math.min(...a) : null, max: a.length ? Math.max(...a) : null },
    b: { n: b.length, media: mb, desvio: desvio(b), mediana: mediana(b), min: b.length ? Math.min(...b) : null, max: b.length ? Math.max(...b) : null },
    diferenca: ma !== null && mb !== null ? mb - ma : null,
    variacao: ma ? ((mb - ma) / ma) * 100 : null,
    cliff: cliff(a, b),
  };
}

// ------------------------------------------------------------------ CSV e Markdown

function gerarCsv() {
  const colunas = ['id', 'grupo', 'status', ...METRICAS.map(([k]) => k)];
  const linhas = [colunas.join(',')];
  for (const e of execucoes) {
    linhas.push([e.id, e.grupo, e.status ?? (e.ausente ? 'nao-executada' : ''), ...METRICAS.map(([k]) => valor(e, k) ?? '')].join(','));
  }
  return `${linhas.join('\n')}\n`;
}

function gerarMarkdown() {
  const L = [];
  L.push(`# Resultados do experimento${ENSAIO ? ' — ENSAIO (dados sintéticos, não usar no relatório)' : ''}`, '');
  L.push(`Gerado em ${new Date().toLocaleString('pt-BR')} por \`scripts/consolidar-resultados.mjs\`.`, '');
  const feitas = execucoes.filter((e) => !e.ausente).map((e) => e.id);
  L.push(`Execuções consolidadas: ${feitas.length ? feitas.join(', ') : 'nenhuma'}${feitas.length < IDS.length ? ` (faltam: ${IDS.filter((i) => !feitas.includes(i)).join(', ')})` : ''}.`, '');

  L.push('## 1. Resultados por execução', '');
  L.push('| Execução | Condição | Status | Testes falhando (1ª) | Violações (1ª) | Build (1ª) | Intervenções | Rodadas | Tempo (min) | Testes falhando (final) | Violações (final) |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const e of execucoes) {
    if (e.ausente) {
      L.push(`| ${e.id} | ${NOME[e.grupo]} | não executada | — | — | — | — | — | — | — | — |`);
      continue;
    }
    const p = e.primeiraEntrega;
    const f = e.final;
    L.push(
      `| ${e.id} | ${NOME[e.grupo]} | ${e.status} | ${p.testesFalhando}/${p.testesTotal} | ${p.violacoes} | ${p.build ? 'ok' : 'falhou'} | ${e.intervencoes.total} | ${e.intervencoes.promptsDeCorrecao} | ${num(e.tempo.minutos)} | ${f.testesFalhando}/${f.testesTotal} | ${f.violacoes} |`,
    );
  }

  L.push('', '## 2. Comparação entre as condições (estatística descritiva)', '');
  L.push('Média ± desvio-padrão amostral, mediana e intervalo (mín–máx). "Diferença" = média B − média A. O delta de Cliff varia de −1 a +1: positivo indica valores maiores em A (sem harness). Magnitude pelos limiares de Romano et al. (2006).', '');
  L.push('| Métrica | Sem harness (A) | Com harness (B) | Diferença (B − A) | Variação | Delta de Cliff |');
  L.push('|---|---|---|---|---|---|');
  for (const [k, rotulo] of METRICAS) {
    const s = estatisticas(k);
    const fmt = (g) => (g.n ? `${num(g.media)} ± ${num(g.desvio)} (med. ${num(g.mediana)}; ${num(g.min)}–${num(g.max)})` : '—');
    L.push(
      `| ${rotulo} | ${fmt(s.a)} | ${fmt(s.b)} | ${num(s.diferenca)} | ${s.variacao === null ? '—' : `${s.variacao > 0 ? '+' : ''}${num(s.variacao, 0)}%`} | ${s.cliff === null ? '—' : `${num(s.cliff, 2)} (${magnitudeCliff(s.cliff)})`} |`,
    );
  }

  L.push('', '## 3. Violações por regra na primeira entrega (soma por condição)', '');
  const regras = ['RX01', 'RX02', 'RX03', 'RX04', 'RX05', 'RX06', 'RX07', 'RX08', 'RX09'];
  L.push('| Regra | Sem harness (A) | Com harness (B) |', '|---|---|---|');
  for (const r of regras) {
    const soma = (g) => execucoes.filter((e) => e.grupo === g && !e.ausente).reduce((s, e) => s + (e.primeiraEntrega.porRegra?.[r] ?? 0), 0);
    L.push(`| ${r} | ${soma('A')} | ${soma('B')} |`);
  }

  const comHarness = execucoes.filter((e) => e.grupo === 'B' && e.harness);
  if (comHarness.length) {
    L.push('', '## 4. Atuação do harness (grupo B)', '');
    L.push('| Execução | Edições verificadas pelo hook | Edições com violação | Encerramentos bloqueados (Stop) | Validações ok | Validações com falha |', '|---|---|---|---|---|---|');
    for (const e of comHarness) {
      const h = e.harness;
      L.push(`| ${e.id} | ${h.edicoesVerificadas} | ${h.edicoesComViolacao} | ${h.bloqueiosDoStop} | ${h.validacoesOk} | ${h.validacoesComFalha} |`);
    }
  }

  L.push('', '## 5. Gráficos', '');
  for (const [arquivo, legenda] of GRAFICOS) L.push(`- [\`graficos/${arquivo}\`](graficos/${arquivo}) — ${legenda}`);
  L.push('', '> Limitações: n = 3 por condição, um único modelo/agente e uma única tarefa; os números descrevem este experimento e não permitem generalização estatística. Ver `docs/05-metodologia.md` (ameaças à validade).');
  return `${L.join('\n')}\n`;
}

// ------------------------------------------------------------------ gráficos SVG

const ESTILO = `
  <style>
    svg { --surface:#fcfcfb; --ink:#0b0b0b; --ink2:#52514e; --muted:#898781; --grid:#e1e0d9; --base:#c3c2b7; --A:#2a78d6; --B:#eb6834; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    @media (prefers-color-scheme: dark) { svg { --surface:#1a1a19; --ink:#f0efec; --ink2:#c3c2b7; --muted:#898781; --grid:#2c2c2a; --base:#383835; --A:#3987e5; --B:#d95926; } }
    .fundo { fill: var(--surface); }
    .titulo { fill: var(--ink); font-size: 18px; font-weight: 600; }
    .subtitulo { fill: var(--ink2); font-size: 13px; }
    .eixo { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
    .rotulo { fill: var(--ink2); font-size: 12px; }
    .valor { fill: var(--ink); font-size: 12px; font-weight: 600; }
    .grade { stroke: var(--grid); stroke-width: 1; }
    .base { stroke: var(--base); stroke-width: 1; }
    .media { stroke: var(--ink2); stroke-width: 1.5; }
    .A { fill: var(--A); } .B { fill: var(--B); }
  </style>`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Coluna com cantos de 4px arredondados no topo e base reta. */
function coluna(x, yTopo, largura, yBase, classe, titulo) {
  const h = yBase - yTopo;
  if (h <= 0) return `<line x1="${x}" x2="${x + largura}" y1="${yBase}" y2="${yBase}" class="base"><title>${esc(titulo)}</title></line>`;
  const r = Math.min(4, h, largura / 2);
  const d = `M${x},${yBase} V${yTopo + r} Q${x},${yTopo} ${x + r},${yTopo} H${x + largura - r} Q${x + largura},${yTopo} ${x + largura},${yTopo + r} V${yBase} Z`;
  return `<path d="${d}" class="${classe}"><title>${esc(titulo)}</title></path>`;
}

function escalaBonita(maximo) {
  if (!maximo || maximo <= 0) return { max: 4, passo: 1 };
  const passos = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
  const passo = passos.find((p) => maximo / p <= 5) ?? 1000000;
  return { max: Math.ceil(maximo / passo) * passo, passo };
}

function legenda(x, y) {
  return `<g transform="translate(${x},${y})">
    <rect x="0" y="-9" width="10" height="10" rx="2" class="A"/><text x="16" y="0" class="rotulo">${NOME.A}</text>
    <rect x="150" y="-9" width="10" height="10" rx="2" class="B"/><text x="166" y="0" class="rotulo">${NOME.B}</text>
  </g>`;
}

/** Colunas por execução, agrupadas por condição, com a média de cada condição. */
function graficoPorExecucao(chave, titulo, subtitulo, unidade) {
  const W = 720;
  const H = 400;
  const m = { topo: 96, dir: 96, base: 64, esq: 56 };
  const pw = W - m.esq - m.dir;
  const ph = H - m.topo - m.base;
  const dados = execucoes.map((e) => ({ id: e.id, grupo: e.grupo, v: valor(e, chave) }));
  const { max, passo } = escalaBonita(Math.max(0, ...dados.map((d) => d.v ?? 0)));
  const y = (v) => m.topo + ph - (v / max) * ph;
  const larguraBanda = pw / (dados.length + 1); // +1: espaço entre os grupos
  const xDe = (i, grupo) => m.esq + larguraBanda * (i + (grupo === 'B' ? 1 : 0)) + larguraBanda / 2;
  const largura = Math.min(24, larguraBanda * 0.5);
  const partes = [`<rect class="fundo" width="${W}" height="${H}"/>`];
  partes.push(`<text x="${m.esq}" y="32" class="titulo">${esc(titulo)}</text>`);
  partes.push(`<text x="${m.esq}" y="52" class="subtitulo">${esc(subtitulo)}</text>`);
  partes.push(legenda(m.esq, 78));
  for (let t = 0; t <= max; t += passo) {
    partes.push(`<line x1="${m.esq}" x2="${m.esq + pw}" y1="${y(t)}" y2="${y(t)}" class="${t === 0 ? 'base' : 'grade'}"/>`);
    partes.push(`<text x="${m.esq - 8}" y="${y(t) + 4}" text-anchor="end" class="eixo">${num(t)}</text>`);
  }
  dados.forEach((d, i) => {
    const xc = xDe(i, d.grupo);
    const base = y(0);
    if (d.v === null) {
      partes.push(`<text x="${xc}" y="${base - 6}" text-anchor="middle" class="eixo">n/d</text>`);
    } else {
      partes.push(coluna(xc - largura / 2, y(d.v), largura, base, d.grupo, `${d.id}: ${num(d.v)} ${unidade}`));
      partes.push(`<text x="${xc}" y="${y(d.v) - 6}" text-anchor="middle" class="valor">${num(d.v)}</text>`);
    }
    partes.push(`<text x="${xc}" y="${base + 18}" text-anchor="middle" class="rotulo">${esc(d.id)}</text>`);
  });
  for (const g of ['A', 'B']) {
    const idx = dados.map((d, i) => (d.grupo === g ? i : -1)).filter((i) => i >= 0);
    const vs = idx.map((i) => dados[i].v).filter((v) => v !== null);
    const x0 = xDe(idx[0], g) - largura;
    const x1 = xDe(idx.at(-1), g) + largura;
    partes.push(`<text x="${(x0 + x1) / 2}" y="${y(0) + 40}" text-anchor="middle" class="subtitulo">${NOME[g]}</text>`);
    if (vs.length > 0) {
      const med = media(vs);
      partes.push(`<line x1="${x0}" x2="${x1}" y1="${y(med)}" y2="${y(med)}" class="media"><title>Média ${NOME[g]}: ${num(med, 2)}</title></line>`);
      partes.push(`<text x="${x1 + 6}" y="${y(med) + 4}" class="rotulo">média ${num(med, 1)}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(titulo)}">${ESTILO}\n${partes.join('\n')}\n</svg>\n`;
}

/** Pequenos múltiplos: problemas (build + testes + violações) por checkpoint, um painel por execução. */
function graficoEvolucao() {
  const colunas = 3;
  const linhas = Math.ceil(execucoes.length / colunas);
  const W = 780;
  const painelW = (W - 48) / colunas;
  const painelH = 170;
  const H = 96 + linhas * (painelH + 28);
  const todas = execucoes.flatMap((e) => (e.evolucao ?? []).map(problemas));
  const { max, passo } = escalaBonita(Math.max(1, ...todas));
  const partes = [`<rect class="fundo" width="${W}" height="${H}"/>`];
  partes.push(`<text x="24" y="32" class="titulo">Problemas restantes a cada checkpoint</text>`);
  partes.push(`<text x="24" y="52" class="subtitulo">Build quebrado (1) + testes falhando + violações. E = entrega; C1, C2… = após cada intervenção.</text>`);
  partes.push(legenda(24, 78));
  execucoes.forEach((e, i) => {
    const px = 24 + (i % colunas) * painelW;
    const py = 96 + Math.floor(i / colunas) * (painelH + 28);
    const m = { topo: 28, base: 24, esq: 36, dir: 12 };
    const pw = painelW - m.esq - m.dir;
    const ph = painelH - m.topo - m.base;
    const y = (v) => py + m.topo + ph - (v / max) * ph;
    partes.push(`<text x="${px + m.esq}" y="${py + 14}" class="rotulo"><tspan class="valor">${esc(e.id)}</tspan> · ${esc(e.ausente ? 'não executada' : e.status)}</text>`);
    for (let t = 0; t <= max; t += passo) {
      partes.push(`<line x1="${px + m.esq}" x2="${px + m.esq + pw}" y1="${y(t)}" y2="${y(t)}" class="${t === 0 ? 'base' : 'grade'}"/>`);
      partes.push(`<text x="${px + m.esq - 6}" y="${y(t) + 4}" text-anchor="end" class="eixo">${num(t)}</text>`);
    }
    const pontos = e.evolucao ?? [];
    const banda = pw / Math.max(pontos.length, 4);
    const largura = Math.min(24, banda * 0.6);
    let correcao = 0;
    pontos.forEach((c, j) => {
      const v = problemas(c);
      const xc = px + m.esq + banda * j + banda / 2;
      const rotulo = c.tipo === 'entrega' ? 'E' : c.tipo === 'humano' ? `H${j}` : `C${++correcao}`;
      partes.push(coluna(xc - largura / 2, y(v), largura, y(0), e.grupo, `${e.id} ${rotulo}: ${v} problema(s) — ${c.testesFalhando} testes, ${c.violacoes} violações${c.build ? '' : ', build quebrado'}`));
      partes.push(`<text x="${xc}" y="${y(v) - 5}" text-anchor="middle" class="valor">${v}</text>`);
      partes.push(`<text x="${xc}" y="${y(0) + 15}" text-anchor="middle" class="eixo">${rotulo}</text>`);
    });
    if (!pontos.length) partes.push(`<text x="${px + m.esq + pw / 2}" y="${y(0) - 8}" text-anchor="middle" class="eixo">sem dados</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Problemas restantes a cada checkpoint">${ESTILO}\n${partes.join('\n')}\n</svg>\n`;
}

/** Barras horizontais agrupadas: violações por regra na 1ª entrega (soma por condição). */
function graficoRegras() {
  const regras = [
    ['RX01', 'subscribe aninhado'],
    ['RX02', 'subscribe fora do ciclo de vida'],
    ['RX03', 'Subject exposto'],
    ['RX04', 'estado mutável'],
    ['RX05', 'temporizador imperativo'],
    ['RX06', 'eventos fora do RxJS'],
    ['RX07', 'emissor conhece observador'],
    ['RX08', 'acumulador mutado'],
    ['RX09', 'dependência circular'],
  ];
  const soma = (g, r) => execucoes.filter((e) => e.grupo === g && !e.ausente).reduce((s, e) => s + (e.primeiraEntrega?.porRegra?.[r] ?? 0), 0);
  const W = 720;
  const m = { topo: 96, esq: 280, dir: 48, base: 24 };
  const barra = 12;
  const linha = barra * 2 + 2 + 14;
  const H = m.topo + regras.length * linha + m.base;
  const pw = W - m.esq - m.dir;
  const { max, passo } = escalaBonita(Math.max(1, ...regras.flatMap(([r]) => [soma('A', r), soma('B', r)])));
  const x = (v) => m.esq + (v / max) * pw;
  const partes = [`<rect class="fundo" width="${W}" height="${H}"/>`];
  partes.push(`<text x="24" y="32" class="titulo">Violações por regra na primeira entrega</text>`);
  partes.push(`<text x="24" y="52" class="subtitulo">Soma das 3 execuções de cada condição (verificador RX01–RX09).</text>`);
  partes.push(legenda(24, 78));
  for (let t = 0; t <= max; t += passo) {
    partes.push(`<line x1="${x(t)}" x2="${x(t)}" y1="${m.topo - 4}" y2="${H - m.base}" class="${t === 0 ? 'base' : 'grade'}"/>`);
    partes.push(`<text x="${x(t)}" y="${H - 6}" text-anchor="middle" class="eixo">${num(t)}</text>`);
  }
  regras.forEach(([r, nome], i) => {
    const y0 = m.topo + i * linha;
    partes.push(`<text x="${m.esq - 10}" y="${y0 + barra + 5}" text-anchor="end" class="rotulo">${r} · ${esc(nome)}</text>`);
    ['A', 'B'].forEach((g, k) => {
      const v = soma(g, r);
      const yb = y0 + k * (barra + 2);
      const w = x(v) - m.esq;
      if (w > 0) {
        const rr = Math.min(4, w);
        partes.push(`<path d="M${m.esq},${yb} H${m.esq + w - rr} Q${m.esq + w},${yb} ${m.esq + w},${yb + rr} V${yb + barra - rr} Q${m.esq + w},${yb + barra} ${m.esq + w - rr},${yb + barra} H${m.esq} Z" class="${g}"><title>${r} — ${NOME[g]}: ${v}</title></path>`);
      }
      partes.push(`<text x="${m.esq + Math.max(w, 0) + 6}" y="${yb + barra - 2}" class="eixo">${v}</text>`);
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Violações por regra na primeira entrega">${ESTILO}\n${partes.join('\n')}\n</svg>\n`;
}

const GRAFICOS = [
  ['1-testes-primeira-entrega.svg', 'testes de aceitação falhando na primeira entrega, por execução'],
  ['2-violacoes-primeira-entrega.svg', 'violações arquiteturais na primeira entrega, por execução'],
  ['3-intervencoes.svg', 'intervenções humanas até o fim da execução'],
  ['4-tempo.svg', 'tempo até o fim da execução'],
  ['5-evolucao-por-checkpoint.svg', 'problemas restantes a cada checkpoint (pequenos múltiplos)'],
  ['6-violacoes-por-regra.svg', 'violações por regra na primeira entrega'],
];

// ------------------------------------------------------------------ principal

mkdirSync(join(DESTINO, 'graficos'), { recursive: true });
writeFileSync(join(DESTINO, 'resultados.csv'), gerarCsv());
writeFileSync(join(DESTINO, 'resultados.md'), gerarMarkdown());
const g = join(DESTINO, 'graficos');
writeFileSync(join(g, GRAFICOS[0][0]), graficoPorExecucao('testes1', 'Testes de aceitação falhando na 1ª entrega', 'De 41 testes ocultos; entrega = resposta do agente ao prompt inicial, antes de qualquer intervenção.', 'teste(s)'));
writeFileSync(join(g, GRAFICOS[1][0]), graficoPorExecucao('violacoes1', 'Violações arquiteturais na 1ª entrega', 'Regras reativas RX01–RX09 verificadas por análise estática (mesmo verificador para A e B).', 'violação(ões)'));
writeFileSync(join(g, GRAFICOS[2][0]), graficoPorExecucao('intervencoes', 'Intervenções humanas até o fim', 'Prompts de correção + edições manuais + outras mensagens humanas depois do prompt inicial.', 'intervenção(ões)'));
writeFileSync(join(g, GRAFICOS[3][0]), graficoPorExecucao('minutos', 'Tempo até o fim da execução', 'Minutos entre o prompt inicial e o último checkpoint.', 'min'));
writeFileSync(join(g, GRAFICOS[4][0]), graficoEvolucao());
writeFileSync(join(g, GRAFICOS[5][0]), graficoRegras());
console.log(`✔ Resultados consolidados em ${DESTINO}`);
for (const e of execucoes) console.log(`  ${e.id}: ${e.ausente ? 'não executada' : e.status}`);
