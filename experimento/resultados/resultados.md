# Resultados do experimento

Gerado em 23/11/2026, 20:29:35 por `scripts/consolidar-resultados.mjs`.

Execuções consolidadas: A1, A2, A3, B1, B2, B3.

## 1. Resultados por execução

| Execução | Condição | Status | Testes falhando (1ª) | Violações (1ª) | Build (1ª) | Intervenções | Rodadas | Tempo (min) | Testes falhando (final) | Violações (final) |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Sem harness (A) | aprovada | 0/41 | 4 | ok | 1 | 1 | 4 | 0/41 | 0 |
| A2 | Sem harness (A) | aprovada | 0/41 | 7 | ok | 1 | 1 | 467 | 0/41 | 0 |
| A3 | Sem harness (A) | aprovada | 0/41 | 3 | ok | 1 | 1 | 6 | 0/41 | 0 |
| B1 | Com harness (B) | aprovada | 0/41 | 0 | ok | 0 | 0 | 4 | 0/41 | 0 |
| B2 | Com harness (B) | aprovada | 0/41 | 0 | ok | 0 | 0 | 3 | 0/41 | 0 |
| B3 | Com harness (B) | aprovada | 0/41 | 0 | ok | 0 | 0 | 4 | 0/41 | 0 |

## 2. Comparação entre as condições (estatística descritiva)

Média ± desvio-padrão amostral, mediana e intervalo (mín–máx). "Diferença" = média B − média A. O delta de Cliff varia de −1 a +1: positivo indica valores maiores em A (sem harness). Magnitude pelos limiares de Romano et al. (2006).

| Métrica | Sem harness (A) | Com harness (B) | Diferença (B − A) | Variação | Delta de Cliff |
|---|---|---|---|---|---|
| Testes de aceitação falhando na 1ª entrega | 0 ± 0 (med. 0; 0–0) | 0 ± 0 (med. 0; 0–0) | 0 | — | 0 (desprezível) |
| Violações arquiteturais na 1ª entrega | 4,7 ± 2,1 (med. 4; 3–7) | 0 ± 0 (med. 0; 0–0) | −4,7 | −100% | 1 (grande) |
| Problemas na 1ª entrega (build + testes + violações) | 4,7 ± 2,1 (med. 4; 3–7) | 0 ± 0 (med. 0; 0–0) | −4,7 | −100% | 1 (grande) |
| Erros de tipo na 1ª entrega | 0 ± 0 (med. 0; 0–0) | 0 ± 0 (med. 0; 0–0) | 0 | — | 0 (desprezível) |
| Intervenções humanas (total) | 1 ± 0 (med. 1; 1–1) | 0 ± 0 (med. 0; 0–0) | −1 | −100% | 1 (grande) |
| Rodadas de correção (prompts de intervenção) | 1 ± 0 (med. 1; 1–1) | 0 ± 0 (med. 0; 0–0) | −1 | −100% | 1 (grande) |
| Edições manuais | 0 ± 0 (med. 0; 0–0) | 0 ± 0 (med. 0; 0–0) | 0 | — | 0 (desprezível) |
| Outras mensagens humanas | 0 ± 0 (med. 0; 0–0) | 0 ± 0 (med. 0; 0–0) | 0 | — | 0 (desprezível) |
| Tempo até o fim (min) | 159 ± 266,7 (med. 6; 4–467) | 3,7 ± 0,6 (med. 4; 3–4) | −155,3 | −98% | 0,78 (grande) |
| Testes falhando no final | 0 ± 0 (med. 0; 0–0) | 0 ± 0 (med. 0; 0–0) | 0 | — | 0 (desprezível) |
| Violações no final | 0 ± 0 (med. 0; 0–0) | 0 ± 0 (med. 0; 0–0) | 0 | — | 0 (desprezível) |
| Chamadas de ferramenta do agente | 11,3 ± 3,8 (med. 13; 7–14) | 8 ± 1 (med. 8; 7–9) | −3,3 | −29% | 0,44 (médio) |
| Erros de ferramenta do agente | 2,7 ± 1,2 (med. 2; 2–4) | 1 ± 1 (med. 1; 0–2) | −1,7 | −63% | 0,78 (grande) |
| Tokens de saída do modelo | 26.759 ± 3.905,8 (med. 28.128; 22.353–29.796) | 24.094 ± 237,9 (med. 24.070; 23.869–24.343) | −2.665 | −10% | 0,33 (médio) |
| Linhas de código (final) | 523,3 ± 88 (med. 522; 436–612) | 730,7 ± 132,8 (med. 795; 578–819) | 207,3 | +40% | −0,78 (grande) |
| Casos de teste escritos pelo agente (final) | 1,3 ± 2,3 (med. 0; 0–4) | 20 ± 2,6 (med. 19; 18–23) | 18,7 | +1.400% | −1 (grande) |

## 3. Violações por regra na primeira entrega (soma por condição)

| Regra | Sem harness (A) | Com harness (B) |
|---|---|---|
| RX01 | 0 | 0 |
| RX02 | 3 | 0 |
| RX03 | 1 | 0 |
| RX04 | 9 | 0 |
| RX05 | 0 | 0 |
| RX06 | 0 | 0 |
| RX07 | 1 | 0 |
| RX08 | 0 | 0 |
| RX09 | 0 | 0 |

## 4. Atuação do harness (grupo B)

| Execução | Edições verificadas pelo hook | Edições com violação | Encerramentos bloqueados (Stop) | Validações ok | Validações com falha |
|---|---|---|---|---|---|
| B1 | 0 | 0 | 0 | 2 | 0 |
| B2 | 0 | 0 | 0 | 2 | 1 |
| B3 | 0 | 0 | 0 | 3 | 0 |

## 5. Gráficos

- [`graficos/1-testes-primeira-entrega.svg`](graficos/1-testes-primeira-entrega.svg) — testes de aceitação falhando na primeira entrega, por execução
- [`graficos/2-violacoes-primeira-entrega.svg`](graficos/2-violacoes-primeira-entrega.svg) — violações arquiteturais na primeira entrega, por execução
- [`graficos/3-intervencoes.svg`](graficos/3-intervencoes.svg) — intervenções humanas até o fim da execução
- [`graficos/4-tempo.svg`](graficos/4-tempo.svg) — tempo até o fim da execução
- [`graficos/5-evolucao-por-checkpoint.svg`](graficos/5-evolucao-por-checkpoint.svg) — problemas restantes a cada checkpoint (pequenos múltiplos)
- [`graficos/6-violacoes-por-regra.svg`](graficos/6-violacoes-por-regra.svg) — violações por regra na primeira entrega

> Limitações: n = 3 por condição, um único modelo/agente e uma única tarefa; os números descrevem este experimento e não permitem generalização estatística. Ver `docs/05-metodologia.md` (ameaças à validade).
