# Material para os slides e o relatório

Guia do que mostrar e de onde tirar cada número/figura. Os números marcados com **[após as execuções]**
saem de `experimento/resultados/` depois de `node scripts/consolidar-resultados.mjs`.

## Roteiro sugerido de slides (~15 slides, 15–20 min)

| # | Slide | Conteúdo | Fonte |
|---|---|---|---|
| 1 | Título | Harness para agentes de IA em Programação Reativa | — |
| 2 | O problema | Agentes de IA tendem ao estilo imperativo; quem garante a arquitetura? | `docs/01-visao-geral.md` |
| 3 | O que é um harness | Guiar · Verificar · Forçar o ciclo (tabela) | `docs/01-visao-geral.md` |
| 4 | Paradigma reativo | Carrinho→Fatura dos slides ⇒ Leilões→Notificações; Observer; Sink/Stream/Listeners | `docs/02-fundamentacao-reativa.md` |
| 5 | Imperativo × reativo no código | trecho do anti-gabarito × trecho do gabarito (mesma regra) | `avaliacao/anti-gabarito/src/leiloes/leiloes.service.ts` × `avaliacao/referencia/src/leiloes/aplicacao/leiloes.service.ts` |
| 6 | A tarefa | API de leilões: endpoints, eventos, anti-sniping, SSE | `docs/03-sistema-leilao.md` |
| 7 | O harness construído | tabela enunciado → componentes | `docs/04-harness.md` |
| 8 | Ciclo de feedback | diagrama de sequência dos hooks | `docs/04-harness.md` |
| 9 | Desenho do experimento | A × B, 3 repetições, ordem ABBAAB, controles | `docs/05-metodologia.md` |
| 10 | Como medimos | 41 testes ocultos + regras RX + intervenções; validação do instrumento (gabarito/anti-gabarito) | `docs/06-instrumento-de-avaliacao.md` |
| 11 | Resultado: erros | gráfico 1 + tabela **[após as execuções]** | `experimento/resultados/graficos/1-testes-primeira-entrega.svg` |
| 12 | Resultado: violações | gráficos 2 e 6 **[após as execuções]** | `.../2-violacoes-primeira-entrega.svg`, `.../6-violacoes-por-regra.svg` |
| 13 | Resultado: intervenções | gráficos 3 e 5 **[após as execuções]** | `.../3-intervencoes.svg`, `.../5-evolucao-por-checkpoint.svg` |
| 14 | Discussão | o que o harness pegou (log dos hooks), ameaças à validade, o bug do temporizador | `resumo.md` das execuções B, `docs/05-metodologia.md` |
| 15 | Conclusão | respostas a H1, H2, H3 + lições | `experimento/resultados/resultados.md` |

Os gráficos são SVG (abrem no navegador e podem ser inseridos no Google Slides/PowerPoint/LibreOffice).

## Estrutura sugerida do relatório

1. **Introdução** — agentes de IA na programação; o problema da conformidade arquitetural; objetivo.
2. **Fundamentação** — programação reativa/orientada a eventos (slides da disciplina); padrão Observer; RxJS; o conceito de harness.
3. **O sistema e a especificação** — `docs/03-sistema-leilao.md`, `experimento/prompts/tarefa.md`.
4. **O harness** — componentes, regras RX, camadas, validação, hooks (`docs/04-harness.md`).
5. **Metodologia** — desenho, controles, métricas, procedimento, instrumento e sua validação (`docs/05`, `docs/06`, `experimento/protocolo.md`).
6. **Resultados** — tabelas e gráficos de `experimento/resultados/`; evolução por checkpoint; atuação do harness.
7. **Discussão** — interpretação de H1–H3; exemplos concretos (diffs de `git diff execucoes/A1/entrega execucoes/A1/final`); ameaças à validade.
8. **Conclusão e trabalhos futuros** — mais repetições, outros agentes/modelos, frontend com RxJS, harness sem hooks (ablação).
9. **Apêndices** — linha do tempo (`docs/linha-do-tempo.md`), decisões (`docs/decisoes.md`), histórico git (`docs/historico-git.md`).

## Achados já disponíveis (antes das execuções)

- O gerador oficial do NestJS 12 já cria `AGENTS.md`, `CLAUDE.md` e skills para agentes (`docs/evidencias/`).
- Mesma funcionalidade, 41/41 testes, paradigmas opostos: o anti-gabarito tem 12 violações, o gabarito 0.
- O bug do temporizador (~8% dos disparos 1 ms adiantados) e como foi encontrado e corrigido (ADR-008).

## Capturas de tela recomendadas (durante as execuções)

- O agente B lendo o `AGENTS.md` / rodando `npm run validate` sozinho.
- Uma mensagem de hook bloqueando o encerramento (*Stop hook*) ou mostrando violações após uma edição.
- O terminal de um `checkpoint.sh` reprovado (com o prompt de intervenção) e de um aprovado.
- `git log --graph --all --oneline` mostrando os ramos `execucoes/*`.

## Comandos úteis para extrair exemplos

```bash
git diff execucoes/A1/entrega execucoes/A1/final -- src/       # o que mudou após as intervenções
git log --format='%h %an | %s' execucoes/B1                     # commits do agente × humano
cat experimento/execucoes/A1/checkpoints/01-entrega/intervencao.md   # o que o "revisor" pediu
cat experimento/execucoes/B1/harness-hooks.log                  # o harness trabalhando
```
