# Avaliação — B2 — checkpoint 1 (entrega)

- Avaliado em: 2026-11-23T15:21:19.383Z
- Projeto: `~/projetos-leilao/B2` (commit `d80173117a`)
- **Aprovado:** sim ✅

| Métrica | Valor |
|---|---|
| Build (`npm run build`) | ok |
| Erros de tipo (`tsc --noEmit`, inclui testes) | 0 |
| Testes de aceitação | 41/41 passaram |
| Violações arquiteturais (RX01–RX09) | 0 |
| Lint genérico (oxlint, config da base) | 0 erros, 0 avisos |
| Código | 13 arquivos, 578 linhas |
| Testes escritos pelo agente | 3 arquivos, 23 casos (+ 11 herdados da base/harness) |
| Chamadas a `.subscribe(` | 3 |
| Dependências adicionadas | — |
| Arquivos do harness alterados/removidos | nenhum |

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

Imports de `rxjs`: `EMPTY`, `Observable`, `Subject`, `concatMap`, `defaultIfEmpty`, `defer`, `filter`, `first`, `firstValueFrom`, `groupBy`, `map`, `merge`, `mergeMap`, `scan`, `share`, `shareReplay`, `startWith`, `switchMap`, `take`, `takeUntil`, `takeWhile`, `throwError`, `timer`
