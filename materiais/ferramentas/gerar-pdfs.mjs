// Gera os três PDFs da entrega a partir dos HTML de materiais/.
//   cd materiais/ferramentas && npm install && npm run pdf          (todos)
//   node gerar-pdfs.mjs livro                                        (só um)
// Slides: uma <section class="slide"> por página (1280×720 px).
// Roteiro e livro: paginados com Paged.js (cabeçalhos, números de página, sumário com páginas).
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const raiz = resolve(import.meta.dirname, '..');
const polyfill = resolve(import.meta.dirname, 'node_modules/pagedjs/dist/paged.polyfill.js');
const chrome = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/snap/bin/chromium'].find(existsSync);

const documentos = {
  slides: { html: 'slides/slides.html', pdf: 'Harness-Reativo-1-Slides.pdf', paginado: false },
  roteiro: { html: 'roteiro/roteiro.html', pdf: 'Harness-Reativo-2-Roteiro.pdf', paginado: true },
  livro: { html: 'livro/livro.html', pdf: 'Harness-Reativo-3-Livro.pdf', paginado: true },
};

// Miniaturas de cada slide (usadas no roteiro) e figuras recortadas dos slides (usadas no livro),
// para que os três materiais mostrem exatamente os mesmos diagramas e gráficos.
async function exportarImagens(pagina) {
  const dirSlides = resolve(raiz, 'imagens/slides');
  const dirFiguras = resolve(raiz, 'imagens/figuras');
  mkdirSync(dirSlides, { recursive: true });
  mkdirSync(dirFiguras, { recursive: true });
  await pagina.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  const slides = await pagina.$$('section.slide');
  for (const [i, slide] of slides.entries()) {
    await slide.screenshot({ path: `${dirSlides}/slide-${String(i + 1).padStart(2, '0')}.png` });
  }
  const figuras = await pagina.$$('[data-figura]');
  for (const fig of figuras) {
    const nomeFig = await fig.evaluate((e) => e.dataset.figura);
    await fig.screenshot({ path: `${dirFiguras}/${nomeFig}.png`, omitBackground: false });
  }
  console.log(`✔ ${slides.length} miniaturas e ${figuras.length} figuras em imagens/`);
}

const pedidos = process.argv.slice(2);
const alvos = pedidos.length ? pedidos : Object.keys(documentos);

const navegador = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--allow-file-access-from-files'] });
try {
  for (const nome of alvos) {
    const doc = documentos[nome];
    if (!doc) throw new Error(`documento desconhecido: ${nome}`);
    const pagina = await navegador.newPage();
    pagina.on('console', (m) => { if (m.type() === 'error') console.error(`[${nome}] ${m.text()}`); });
    pagina.on('pageerror', (e) => console.error(`[${nome}] ${e.message}`));
    await pagina.goto(`file://${resolve(raiz, doc.html)}`, { waitUntil: 'networkidle0' });
    await pagina.evaluate(() => document.fonts.ready);
    if (doc.paginado) {
      await pagina.evaluate(() => { window.PagedConfig = { auto: false }; });
      await pagina.addScriptTag({ path: polyfill });
      await pagina.evaluate(async () => { await window.PagedPolyfill.preview(); });
      const paginas = await pagina.evaluate(() => document.querySelectorAll('.pagedjs_page').length);
      console.log(`${nome}: ${paginas} páginas`);
    }
    await pagina.pdf({ path: resolve(raiz, doc.pdf), preferCSSPageSize: true, printBackground: true });
    console.log(`✔ ${doc.pdf}`);
    if (nome === 'slides') await exportarImagens(pagina);
    await pagina.close();
  }
} finally {
  await navegador.close();
}
