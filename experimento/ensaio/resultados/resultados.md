# Resultados do experimento — ENSAIO (dados sintéticos, não usar no relatório)

Gerado em 23/11/2026, 11:10:44 por `scripts/consolidar-resultados.mjs`.

Execuções consolidadas: ENSAIO-A, ENSAIO-B.

## 1. Resultados por execução

| Execução | Condição | Status | Testes falhando (1ª) | Violações (1ª) | Build (1ª) | Intervenções | Rodadas | Tempo (min) | Testes falhando (final) | Violações (final) |
|---|---|---|---|---|---|---|---|---|---|---|
| ENSAIO-A | Sem harness (A) | aprovada | 0/41 | 12 | ok | 1 | 1 | 1 | 0/41 | 0 |
| ENSAIO-B | Com harness (B) | aprovada | 0/41 | 0 | ok | 0 | 0 | 1 | 0/41 | 0 |

## 2. Comparação entre as condições (estatística descritiva)

Média ± desvio-padrão amostral, mediana e intervalo (mín–máx). "Diferença" = média B − média A. O delta de Cliff varia de −1 a +1: positivo indica valores maiores em A (sem harness). Magnitude pelos limiares de Romano et al. (2006).

| Métrica | Sem harness (A) | Com harness (B) | Diferença (B − A) | Variação | Delta de Cliff |
|---|---|---|---|---|---|
| Testes de aceitação falhando na 1ª entrega | 0 ± — (med. 0; 0–0) | 0 ± — (med. 0; 0–0) | 0 | — | 0 (desprezível) |
| Violações arquiteturais na 1ª entrega | 12 ± — (med. 12; 12–12) | 0 ± — (med. 0; 0–0) | -12 | -100% | 1 (grande) |
| Problemas na 1ª entrega (build + testes + violações) | 12 ± — (med. 12; 12–12) | 0 ± — (med. 0; 0–0) | -12 | -100% | 1 (grande) |
| Erros de tipo na 1ª entrega | 0 ± — (med. 0; 0–0) | 0 ± — (med. 0; 0–0) | 0 | — | 0 (desprezível) |
| Intervenções humanas (total) | 1 ± — (med. 1; 1–1) | 0 ± — (med. 0; 0–0) | -1 | -100% | 1 (grande) |
| Rodadas de correção (prompts de intervenção) | 1 ± — (med. 1; 1–1) | 0 ± — (med. 0; 0–0) | -1 | -100% | 1 (grande) |
| Edições manuais | 0 ± — (med. 0; 0–0) | 0 ± — (med. 0; 0–0) | 0 | — | 0 (desprezível) |
| Outras mensagens humanas | — | — | — | — | — |
| Tempo até o fim (min) | 1 ± — (med. 1; 1–1) | 1 ± — (med. 1; 1–1) | 0 | 0% | 0 (desprezível) |
| Testes falhando no final | 0 ± — (med. 0; 0–0) | 0 ± — (med. 0; 0–0) | 0 | — | 0 (desprezível) |
| Violações no final | 0 ± — (med. 0; 0–0) | 0 ± — (med. 0; 0–0) | 0 | — | 0 (desprezível) |
| Chamadas de ferramenta do agente | — | — | — | — | — |
| Erros de ferramenta do agente | — | — | — | — | — |
| Tokens de saída do modelo | — | — | — | — | — |
| Linhas de código (final) | 843 ± — (med. 843; 843–843) | 843 ± — (med. 843; 843–843) | 0 | 0% | 0 (desprezível) |
| Casos de teste escritos pelo agente (final) | 11 ± — (med. 11; 11–11) | 22 ± — (med. 22; 22–22) | 11 | +100% | -1 (grande) |

## 3. Violações por regra na primeira entrega (soma por condição)

| Regra | Sem harness (A) | Com harness (B) |
|---|---|---|
| RX01 | 0 | 0 |
| RX02 | 1 | 0 |
| RX03 | 1 | 0 |
| RX04 | 5 | 0 |
| RX05 | 3 | 0 |
| RX06 | 0 | 0 |
| RX07 | 2 | 0 |
| RX08 | 0 | 0 |
| RX09 | 0 | 0 |

## 4. Atuação do harness (grupo B)

| Execução | Edições verificadas pelo hook | Edições com violação | Encerramentos bloqueados (Stop) | Validações ok | Validações com falha |
|---|---|---|---|---|---|
| ENSAIO-B | 1 | 0 | 0 | 1 | 0 |

## 5. Gráficos

- [`graficos/1-testes-primeira-entrega.svg`](graficos/1-testes-primeira-entrega.svg) — testes de aceitação falhando na primeira entrega, por execução
- [`graficos/2-violacoes-primeira-entrega.svg`](graficos/2-violacoes-primeira-entrega.svg) — violações arquiteturais na primeira entrega, por execução
- [`graficos/3-intervencoes.svg`](graficos/3-intervencoes.svg) — intervenções humanas até o fim da execução
- [`graficos/4-tempo.svg`](graficos/4-tempo.svg) — tempo até o fim da execução
- [`graficos/5-evolucao-por-checkpoint.svg`](graficos/5-evolucao-por-checkpoint.svg) — problemas restantes a cada checkpoint (pequenos múltiplos)
- [`graficos/6-violacoes-por-regra.svg`](graficos/6-violacoes-por-regra.svg) — violações por regra na primeira entrega

> Limitações: n = 3 por condição, um único modelo/agente e uma única tarefa; os números descrevem este experimento e não permitem generalização estatística. Ver `docs/05-metodologia.md` (ameaças à validade).
