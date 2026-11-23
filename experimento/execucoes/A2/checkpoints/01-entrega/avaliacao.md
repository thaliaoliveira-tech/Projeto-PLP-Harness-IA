# Avaliação — A2 — checkpoint 1 (entrega)

- Avaliado em: 2026-11-23T15:25:26.153Z
- Projeto: `~/projetos-leilao/A2` (commit `912f69565a`)
- **Aprovado:** não ❌

| Métrica | Valor |
|---|---|
| Build (`npm run build`) | ok |
| Erros de tipo (`tsc --noEmit`, inclui testes) | 0 |
| Testes de aceitação | 41/41 passaram |
| Violações arquiteturais (RX01–RX09) | 7 |
| Lint genérico (oxlint, config da base) | 0 erros, 0 avisos |
| Código | 6 arquivos, 429 linhas |
| Testes escritos pelo agente | 0 arquivos, 0 casos (+ 0 herdados da base/harness) |
| Chamadas a `.subscribe(` | 3 |
| Dependências adicionadas | — |

## Violações por regra

| Regra | Ocorrências |
|---|---|
| RX02 | 1 |
| RX03 | 1 |
| RX04 | 4 |
| RX07 | 1 |

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

Imports de `rxjs`: `Observable`, `Subject`, `concat`, `concatMap`, `from`, `map`, `switchMap`, `takeWhile`, `timer`
