# Avaliação — A3 — checkpoint 1 (entrega)

- Avaliado em: 2026-11-23T23:17:19.933Z
- Projeto: `~/projetos-leilao/A3` (commit `46c2bead65`)
- **Aprovado:** não ❌

| Métrica | Valor |
|---|---|
| Build (`npm run build`) | ok |
| Erros de tipo (`tsc --noEmit`, inclui testes) | 0 |
| Testes de aceitação | 41/41 passaram |
| Violações arquiteturais (RX01–RX09) | 3 |
| Lint genérico (oxlint, config da base) | 0 erros, 0 avisos |
| Código | 5 arquivos, 351 linhas |
| Testes escritos pelo agente | 1 arquivos, 4 casos (+ 0 herdados da base/harness) |
| Chamadas a `.subscribe(` | 3 |
| Dependências adicionadas | — |

## Violações por regra

| Regra | Ocorrências |
|---|---|
| RX02 | 1 |
| RX04 | 2 |

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

Imports de `rxjs`: `Observable`, `Subject`, `Subscription`, `concat`, `concatMap`, `defer`, `from`, `map`, `takeWhile`, `timer`
