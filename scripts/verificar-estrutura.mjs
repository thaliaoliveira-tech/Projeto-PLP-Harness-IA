#!/usr/bin/env node
// Verifica a estrutura de pastas exigida pela arquitetura (parte do harness).
//
//  E01 arquivo-fora-da-estrutura   todo .ts de src/ fica em src/<modulo>/{dominio,aplicacao,http}/
//                                   ou é src/<modulo>/<modulo>.module.ts (exceções: src/main.ts, src/app.*.ts)
//  E02 dominio-sem-teste            todo arquivo de dominio/ com código (não só tipos) tem um .spec.ts ao lado
//  E03 papel-na-camada-errada       *.controller.ts só em http/; *.service.ts só em aplicacao/
//
// Uso: node scripts/verificar-estrutura.mjs [--raiz <dir>]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

const args = process.argv.slice(2);
const iRaiz = args.indexOf('--raiz');
const raiz = iRaiz >= 0 ? args[iRaiz + 1] : process.cwd();
const SRC = join(raiz, 'src');
const CAMADAS = new Set(['dominio', 'aplicacao', 'http']);

const ehTeste = (f) => /\.(spec|test|e2e-spec)\.ts$/.test(f);

function listar(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((nome) => {
    const c = join(dir, nome);
    return statSync(c).isDirectory() ? listar(c) : nome.endsWith('.ts') && !nome.endsWith('.d.ts') ? [c] : [];
  });
}

/** Um arquivo só de tipos não tem código executável a testar. */
function somenteTipos(caminho) {
  const texto = readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  return !/\b(function|class|const|let|var|enum)\b/.test(texto.replace(/export\s+type\s[^;]+;/g, ''));
}

const problemas = [];
const arquivos = listar(SRC);
for (const abs of arquivos) {
  const rel = relative(SRC, abs).split(sep).join('/');
  const partes = rel.split('/');
  const nome = basename(rel);
  if (ehTeste(nome)) continue;

  if (partes.length === 1) {
    if (nome !== 'main.ts' && !/^app\.[\w-]+\.ts$/.test(nome)) {
      problemas.push(['E01', rel, 'arquivo solto em src/ (use src/<modulo>/<camada>/)']);
    }
    continue;
  }
  const [modulo, segundo] = partes;
  if (partes.length === 2) {
    if (nome !== `${modulo}.module.ts`) {
      problemas.push(['E01', rel, `na raiz do módulo só pode haver ${modulo}.module.ts`]);
    }
    continue;
  }
  if (!CAMADAS.has(segundo)) {
    problemas.push(['E01', rel, `camada "${segundo}" inválida (use dominio/, aplicacao/ ou http/)`]);
    continue;
  }
  if (nome.endsWith('.controller.ts') && segundo !== 'http') {
    problemas.push(['E03', rel, 'controllers ficam em http/']);
  }
  if (nome.endsWith('.service.ts') && segundo !== 'aplicacao') {
    problemas.push(['E03', rel, 'serviços (fluxos RxJS) ficam em aplicacao/']);
  }
  if (segundo === 'dominio' && !somenteTipos(abs)) {
    const spec = abs.replace(/\.ts$/, '.spec.ts');
    if (!existsSync(spec)) {
      problemas.push(['E02', rel, `crie o teste unitário ${relative(raiz, spec).split(sep).join('/')}`]);
    }
  }
}

if (problemas.length === 0) {
  console.log(`✔ Estrutura: ${arquivos.length} arquivo(s) em conformidade.`);
  process.exit(0);
}
for (const [regra, arquivo, msg] of problemas) console.log(`✖ ${regra} src/${arquivo}: ${msg}`);
console.log(`✖ Estrutura: ${problemas.length} problema(s). Ver docs/arquitetura.md (Camadas).`);
process.exit(1);
