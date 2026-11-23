# Resumo da execução A2 (sem harness)

- **Status:** aprovada
- **Intervenções humanas:** 1 (prompts de correção: 1; edições manuais: 0; outras mensagens: 0)
- **Tempo:** 467 min

| Métrica | Primeira entrega | Final |
|---|---|---|
| Build | ok | ok |
| Testes de aceitação falhando | 0/41 | 0/41 |
| Violações arquiteturais | 7 | 0 |
| Violações por regra | RX02=1, RX03=1, RX04=4, RX07=1 | — |
| Erros de tipo | 0 | 0 |
| Erros de lint | 0 | 0 |
| Linhas de código | 429 | 612 |
| Casos de teste escritos no projeto | 0 | 0 |

## Evolução por checkpoint

| # | Tipo | Build | Testes falhando | Violações |
|---|---|---|---|---|
| 1 | entrega | ok | 0 | 7 |
| 2 | correcao | ok | 0 | 0 |

## Sessão do agente

- Modelo: claude-sonnet-5-5, <synthetic> · Claude Code 2.1.300 · esforço medium
- Mensagens humanas: 3 · interrupções: 0
- Chamadas de ferramenta: 13 (erros: 4)
- Execuções: validate 0, testes 1, build 0
- Tokens: saída 29796, entrada 32, cache lido 487223
