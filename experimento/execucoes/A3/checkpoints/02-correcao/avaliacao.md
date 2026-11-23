# Avaliação — A3 — checkpoint 2 (correcao)

- Avaliado em: 2026-11-23T23:20:39.217Z
- Projeto: `~/projetos-leilao/A3` (commit `19f89264b3`)
- **Aprovado:** sim ✅

| Métrica | Valor |
|---|---|
| Build (`npm run build`) | ok |
| Erros de tipo (`tsc --noEmit`, inclui testes) | 0 |
| Testes de aceitação | 41/41 passaram |
| Violações arquiteturais (RX01–RX09) | 0 |
| Lint genérico (oxlint, config da base) | 0 erros, 0 avisos |
| Código | 6 arquivos, 436 linhas |
| Testes escritos pelo agente | 1 arquivos, 4 casos (+ 0 herdados da base/harness) |
| Chamadas a `.subscribe(` | 2 |
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

Imports de `rxjs`: `EMPTY`, `Observable`, `Subject`, `concatMap`, `defer`, `filter`, `from`, `groupBy`, `map`, `merge`, `mergeMap`, `scan`, `shareReplay`, `startWith`, `switchMap`, `take`, `takeUntil`, `takeWhile`, `timer`
