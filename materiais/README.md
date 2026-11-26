# Materiais de apresentação e documentação

| Arquivo | O que é |
|---|---|
| `Harness-Reativo-1-Slides.pdf` | Apresentação (21 slides, 16:9) |
| `Harness-Reativo-2-Roteiro.pdf` | Roteiro de apresentação (A4): miniatura, fala sugerida, pontos técnicos e transição para cada slide, mais perguntas prováveis |
| `Harness-Reativo-3-Livro.pdf` | Livro completo do trabalho (A4, com sumário, 12 capítulos, referências e apêndices) |

Todos os números vêm de `experimento/resultados/`, `experimento/execucoes/*` e `docs/`.

## Fontes editáveis

- `slides/slides.html`: uma `<section class="slide">` por slide (1280×720).
- `roteiro/roteiro.html` e `livro/livro.html`: paginados com Paged.js (cabeçalhos, números de página e sumário automáticos).
- `fontes/`: identidade visual comum (`identidade.css`), base de impressão (`impresso.css`) e as fontes Inter, Source Serif 4 e JetBrains Mono.
- `imagens/`: gerada a partir dos slides. `slides/` traz as miniaturas usadas no roteiro e `figuras/` traz os diagramas recortados dos slides (elementos com `data-figura`) usados no livro.

## Regenerar os PDFs

Requisitos: Node 24 e Google Chrome ou Chromium.

```bash
cd materiais/ferramentas
npm install
npm run pdf            # gera os três PDFs (e as imagens a partir dos slides)
node gerar-pdfs.mjs livro   # gera um só: slides | roteiro | livro
```

Se você mudar um slide que aparece no roteiro ou no livro, gere os slides primeiro para atualizar as imagens.
