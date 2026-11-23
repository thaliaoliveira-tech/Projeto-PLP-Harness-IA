# Resumo da execução A3 (sem harness)

- **Status:** aprovada
- **Intervenções humanas:** 1 (prompts de correção: 1; edições manuais: 0; outras mensagens: 0)
- **Tempo:** 6 min

| Métrica | Primeira entrega | Final |
|---|---|---|
| Build | ok | ok |
| Testes de aceitação falhando | 0/41 | 0/41 |
| Violações arquiteturais | 3 | 0 |
| Violações por regra | RX02=1, RX04=2 | — |
| Erros de tipo | 0 | 0 |
| Erros de lint | 0 | 0 |
| Linhas de código | 351 | 436 |
| Casos de teste escritos no projeto | 4 | 4 |

## Evolução por checkpoint

| # | Tipo | Build | Testes falhando | Violações |
|---|---|---|---|---|
| 1 | entrega | ok | 0 | 3 |
| 2 | correcao | ok | 0 | 0 |

## Sessão do agente

- Modelo: claude-sonnet-5-5 · Claude Code 2.1.300 · esforço medium
- Mensagens humanas: 2 · interrupções: 0
- Chamadas de ferramenta: 14 (erros: 2)
- Execuções: validate 0, testes 0, build 1
- Tokens: saída 28128, entrada 34, cache lido 543722
