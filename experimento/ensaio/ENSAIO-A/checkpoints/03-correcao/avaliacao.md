# Avaliação — ENSAIO-A — checkpoint 3 (correcao)

- Avaliado em: 2026-11-23T14:18:24.672Z
- Projeto: `/tmp/claude-1001/-home-usuario-Documentos-workspace-Harness-agentes-IA/6b921b54-8282-4503-bfc8-4f9db1995aa8/scratchpad/execucoes/ENSAIO-A` (commit `b8c2398006`)
- **Aprovado:** sim ✅

| Métrica | Valor |
|---|---|
| Build (`npm run build`) | ok |
| Erros de tipo (`tsc --noEmit`, inclui testes) | 0 |
| Testes de aceitação | 41/41 passaram |
| Violações arquiteturais (RX01–RX09) | 0 |
| Lint genérico (oxlint, config da base) | 0 erros, 0 avisos |
| Código | 12 arquivos, 843 linhas |
| Testes escritos pelo agente | 2 arquivos, 11 casos (+ 0 herdados da base/harness) |
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

Imports de `rxjs`: `EMPTY`, `Observable`, `Subject`, `concatMap`, `defer`, `filter`, `first`, `firstValueFrom`, `from`, `groupBy`, `map`, `merge`, `mergeMap`, `scan`, `share`, `shareReplay`, `startWith`, `switchMap`, `take`, `takeUntil`, `takeWhile`, `timer`
