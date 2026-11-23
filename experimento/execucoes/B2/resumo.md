# Resumo da execução B2 (com harness)

- **Status:** aprovada
- **Intervenções humanas:** 0 (prompts de correção: 0; edições manuais: 0; outras mensagens: 0)
- **Tempo:** 3 min

| Métrica | Primeira entrega | Final |
|---|---|---|
| Build | ok | ok |
| Testes de aceitação falhando | 0/41 | 0/41 |
| Violações arquiteturais | 0 | 0 |
| Violações por regra | — | — |
| Erros de tipo | 0 | 0 |
| Erros de lint | 0 | 0 |
| Linhas de código | 578 | 578 |
| Casos de teste escritos no projeto | 23 | 23 |

## Evolução por checkpoint

| # | Tipo | Build | Testes falhando | Violações |
|---|---|---|---|---|
| 1 | entrega | ok | 0 | 0 |

## Sessão do agente

- Modelo: claude-sonnet-5-5 · Claude Code 2.1.300 · esforço medium
- Mensagens humanas: 1 · interrupções: 0
- Chamadas de ferramenta: 8 (erros: 1)
- Execuções: validate 0, testes 0, build 1
- Tokens: saída 23869, entrada 16, cache lido 301696

## Atuação do harness (hooks)

- Edições verificadas pelo hook: 0 (com violação: 0)
- Encerramentos bloqueados pelo hook Stop: 0
- Validações completas: 2 ok, 1 com falha
