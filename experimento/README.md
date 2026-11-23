# Experimento

| Arquivo/pasta | Conteúdo |
|---|---|
| [`protocolo.md`](protocolo.md) | roteiro passo a passo das execuções (leia antes de começar) |
| [`prompts/tarefa.md`](prompts/tarefa.md) | a especificação entregue ao agente — **idêntica** nas condições A e B |
| `modelos/registro.md` | modelo do registro manual (copiado para cada execução) |
| `execucoes/<ID>/` | uma pasta por execução (A1–A3, B1–B3), criada pelos scripts |
| `resultados/` | consolidação final (CSV, tabelas, gráficos) |
| `ensaio/` | ensaio do protocolo com dados sintéticos — **não usar no relatório** |

## Conteúdo de `execucoes/<ID>/`

| Arquivo | Criado por | Conteúdo |
|---|---|---|
| `execucao.json` | scripts | estado e metadados (condição, pasta, ambiente, checkpoints, rodadas) |
| `registro.md` | você | observações manuais (configuração, ocorrências, impressões) |
| `linha-do-tempo.md` | scripts | cronologia da execução |
| `checkpoints/NN-tipo/` | `checkpoint.sh` | avaliação completa: `metricas.json`, `avaliacao.md`, `intervencao.md`, logs |
| `sessao/` | `finalizar-execucao.sh` | transcrições do Claude Code (.jsonl) |
| `resumo-sessao.json` | idem | métricas do processo (mensagens humanas, ferramentas, tokens...) |
| `harness-hooks.log` | idem (só B) | o que os hooks do harness fizeram |
| `resumo.json` / `resumo.md` | idem | resumo final da execução |

O código produzido pelo agente fica no ramo git `execucoes/<ID>` (tags `execucoes/<ID>/entrega` e `execucoes/<ID>/final`).
