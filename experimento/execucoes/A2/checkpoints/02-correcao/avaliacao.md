# Avaliação — A2 — checkpoint 2 (correcao)

- Avaliado em: 2026-11-23T23:10:28.064Z
- Projeto: `~/projetos-leilao/A2` (commit `933266b0dd`)
- **Aprovado:** sim ✅

| Métrica | Valor |
|---|---|
| Build (`npm run build`) | ok |
| Erros de tipo (`tsc --noEmit`, inclui testes) | 0 |
| Testes de aceitação | 41/41 passaram |
| Violações arquiteturais (RX01–RX09) | 0 |
| Lint genérico (oxlint, config da base) | 0 erros, 0 avisos |
| Código | 7 arquivos, 612 linhas |
| Testes escritos pelo agente | 0 arquivos, 0 casos (+ 0 herdados da base/harness) |
| Chamadas a `.subscribe(` | 3 |
| Dependências adicionadas | — |

## Testes de aceitação por grupo

| Arquivo | Falharam / total |
|---|---|
| 01-criacao.test.ts | 0/12 |
| 02-lances.test.ts | 0/10 |
| 03-eventos.test.ts | 0/3 |
| 04-tempo.test.ts | 0/7 |
| 05-notificacoes.test.ts | 0/3 |
| 06-stream.test.ts | 0/4 |
| 07-concorrencia.test.ts | 0/2 |

Imports de `rxjs`: `EMPTY`, `Observable`, `Subject`, `defer`, `filter`, `groupBy`, `ignoreElements`, `map`, `merge`, `mergeMap`, `of`, `scan`, `share`, `shareReplay`, `startWith`, `switchMap`, `take`, `takeUntil`, `takeWhile`, `tap`, `timer`
