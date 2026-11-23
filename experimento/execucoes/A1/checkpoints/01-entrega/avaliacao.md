# Avaliação — A1 — checkpoint 1 (entrega)

- Avaliado em: 2026-11-23T15:06:44.479Z
- Projeto: `~/projetos-leilao/A1` (commit `6a7a74421f`)
- **Aprovado:** não ❌

| Métrica | Valor |
|---|---|
| Build (`npm run build`) | ok |
| Erros de tipo (`tsc --noEmit`, inclui testes) | 0 |
| Testes de aceitação | 41/41 passaram |
| Violações arquiteturais (RX01–RX09) | 4 |
| Lint genérico (oxlint, config da base) | 0 erros, 0 avisos |
| Código | 5 arquivos, 421 linhas |
| Testes escritos pelo agente | 0 arquivos, 0 casos (+ 0 herdados da base/harness) |
| Chamadas a `.subscribe(` | 2 |
| Dependências adicionadas | — |

## Violações por regra

| Regra | Ocorrências |
|---|---|
| RX02 | 1 |
| RX04 | 3 |

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

Imports de `rxjs`: `Observable`, `Subject`, `Subscription`, `concat`, `concatMap`, `defer`, `from`, `map`, `of`, `switchMap`, `takeWhile`, `timer`
