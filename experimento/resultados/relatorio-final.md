# Relatório final — harness × sem harness

## Configuração
- **Implementador:** `claude-sonnet-5-5`, esforço `medium`, limite por chamada `3600 s` (`experimento/config-implementador.env`).
- **CLI:** `2.1.300 (Claude Code)` (sessão nova e isolada por execução, modo `acceptEdits` não interativo).
- **Condutor:** Antigravity (Gemini 4), seguindo integralmente `experimento/ROTEIRO-CONDUTOR.md`.
- **Datas e ordem executada:** `23/11/2026`, na ordem obrigatória **A1 → B1 → B2 → A2 → A3 → B3** (início às `12:04`, pausa por limite de sessão em A2 de `12:28` a `20:08`, conclusão às `20:29`, fuso UTC−3).

## Resultados

Tabelas consolidadas de [`experimento/resultados/resultados.md`](resultados.md):

### Por execução

| Execução | Condição | Status | Testes falhando (1ª) | Violações (1ª) | Build (1ª) | Intervenções | Rodadas | Tempo (min) | Testes falhando (final) | Violações (final) |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Sem harness (A) | aprovada | 0/41 | 4 | ok | 1 | 1 | 4 | 0/41 | 0 |
| A2 | Sem harness (A) | aprovada | 0/41 | 7 | ok | 1 | 1 | 467 | 0/41 | 0 |
| A3 | Sem harness (A) | aprovada | 0/41 | 3 | ok | 1 | 1 | 6 | 0/41 | 0 |
| B1 | Com harness (B) | aprovada | 0/41 | 0 | ok | 0 | 0 | 4 | 0/41 | 0 |
| B2 | Com harness (B) | aprovada | 0/41 | 0 | ok | 0 | 0 | 3 | 0/41 | 0 |
| B3 | Com harness (B) | aprovada | 0/41 | 0 | ok | 0 | 0 | 4 | 0/41 | 0 |

### Comparação entre as condições (A × B)

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

*(Custos somados de `implementador/log.md` por execução: A1 = US$ 0.68, A2 = US$ 1.50 [inclui US$ 0.51 da chamada interrompida por limite de sessão], A3 = US$ 0.76; B1 = US$ 0.47, B2 = US$ 0.47, B3 = US$ 0.49.)*

### Gráficos gerados
- [`graficos/1-testes-primeira-entrega.svg`](graficos/1-testes-primeira-entrega.svg) — testes de aceitação falhando na primeira entrega, por execução
- [`graficos/2-violacoes-primeira-entrega.svg`](graficos/2-violacoes-primeira-entrega.svg) — violações arquiteturais na primeira entrega, por execução
- [`graficos/3-intervencoes.svg`](graficos/3-intervencoes.svg) — intervenções humanas até o fim da execução
- [`graficos/4-tempo.svg`](graficos/4-tempo.svg) — tempo até o fim da execução
- [`graficos/5-evolucao-por-checkpoint.svg`](graficos/5-evolucao-por-checkpoint.svg) — problemas restantes a cada checkpoint
- [`graficos/6-violacoes-por-regra.svg`](graficos/6-violacoes-por-regra.svg) — violações por regra na primeira entrega

## Respostas às hipóteses
- **H1 (menos erros na 1ª entrega com harness):** **Não confirmada / empate em zero nos testes funcionais.** Tanto no grupo A quanto no grupo B, todas as execuções obtiveram build ok, 0 erros de tipo e **0/41** testes de aceitação falhando logo na primeira entrega (`0 ± 0` vs `0 ± 0`, delta de Cliff `0`). Contudo, com harness o implementador escreveu substancialmente mais testes automatizados próprios (`20 ± 2,6` casos em B contra `1,3 ± 2,3` em A; variação `+1.400%`, delta de Cliff `−1`).
- **H2 (menos violações na 1ª entrega com harness):** **Sim (confirmada).** Sem harness (A), houve **4,7 ± 2,1** violações por execução na 1ª entrega (total de 14 violações: A1=4, A2=7, A3=3). Com harness (B), houve **0 ± 0** violações em todas as execuções (`−100%`, delta de Cliff `1`, grande).
- **H3 (menos intervenções com harness):** **Sim (confirmada).** Todas as execuções sem harness (A1, A2, A3) exigiram **1** intervenção humana (`1 ± 0`) para corrigir violações arquiteturais, enquanto todas as execuções com harness (B1, B2, B3) foram aprovadas na 1ª entrega com **0** intervenções (`0 ± 0`, `−100%`, delta de Cliff `1`, grande).

## O que o harness fez na prática

Tabela 4 de [`resultados.md`](resultados.md):

| Execução | Edições verificadas pelo hook | Edições com violação | Encerramentos bloqueados (Stop) | Validações ok | Validações com falha |
|---|---|---|---|---|---|
| B1 | 0 | 0 | 0 | 2 | 0 |
| B2 | 0 | 0 | 0 | 2 | 1 |
| B3 | 0 | 0 | 0 | 3 | 0 |

Na prática, a combinação de documentação arquitetural (`AGENTS.md`, `CLAUDE.md`, `docs/arquitetura.md`, `docs/regras-reativas.md`) e comando único de validação (`npm run validate`) atuou **preventivamente**: os agentes de B1, B2 e B3 já estruturaram desde o início domínios puros, Sink privado com `scan`, log `eventos$` com replay, temporização via `groupBy` + `switchMap(timer)` com prazo agendado e módulo `notificacoes` desacoplado. Por isso, não houve edições com violação capturadas pelo hook pós-edição nem bloqueios do hook `Stop` (que rodou `validate ok` e liberou os 3 encerramentos). Em **B2**, o próprio `npm run validate` executado pelo agente detectou uma falha nos testes unitários de notificações (`harness-hooks.log`: `12:20:20 validate falhou testes-unitarios`), corrigida antes da entrega (`12:20:33 validate ok`).

## Erros mais comuns sem harness

Soma de violações por regra na 1ª entrega (`resultados.md`, seção 3): **RX04 = 9**, **RX02 = 3**, **RX03 = 1**, **RX07 = 1** (total: 14 violações em 3 execuções). Embora todas tenham atingido 41/41 nos testes funcionais de caixa-preta na 1ª entrega, os implementadores misturaram programação reativa com estado mutável e assinaturas imperativas:

1. **RX04 (`estado-mutavel`, 9 ocorrências — 3 em A1, 4 em A2, 2 em A3):** armazenamento de estado em `Map` ou `Subscription` mutados por métodos.
   - A1 (`execucoes/A1/entrega:src/leilao.service.ts`): `this.registros.set(leilao.id, r)`, `this.subs.add(...)`, `this.notificacoes.set(nome, lista)`.
   - A2 (`execucoes/A2/entrega:src/leilao.service.ts` e `src/notificacoes.service.ts`): `this.leiloes.set(leilao.id, estado)` e três `Map`s mutáveis em notificações (`titulos`, `lideres`, `porParticipante`).
   - A3 (`execucoes/A3/entrega:src/leiloes/leiloes.service.ts`): `this.leiloes.set(leilao.id, reg)` e `this.notificacoes.set(nome, lista)`.
2. **RX02 (`subscribe-fora-do-ciclo-de-vida`, 3 ocorrências — 1 em cada A):** criação dinâmica de `.subscribe()` ao abrir cada leilão para agendar o encerramento (em vez de fluxo único em `onModuleInit` com `takeUntil(destruir$)`).
   - A1: `this.subs.add(r.agendar$.pipe(switchMap(...)).subscribe(...))`
   - A2: `estado.prazo$.pipe(switchMap(...)).subscribe(...)`
   - A3: `reg.timer = timer(delay).subscribe(...)`
3. **RX03 (`subject-exposto`, 1 ocorrência em A2):** `readonly todosEventos$ = new Subject<EventoLeilao>();` em `src/leilao.service.ts:34`.
4. **RX07 (`emissor-conhece-observador`, 1 ocorrência em A2):** `src/leiloes.controller.ts:14` importando diretamente `NotificacoesService`.

## Limitações e ocorrências
- **Limitações metodológicas:** amostra pequena (`n = 3` por condição), um único modelo/esforço (`claude-sonnet-5-5/medium`) e uma única tarefa (API de leilões em NestJS + RxJS); os resultados não permitem generalização estatística (ver `docs/05-metodologia.md`).
- **Ocorrência em A2 (limite de sessão da conta):** durante a rodada 01 (`intervencao`) de A2 (`12:25–12:28`), a CLI retornou código 1 por limite de sessão (`429 usage_limit_reached`, reset às `14:10`). Conforme a seção 7 do `ROTEIRO-CONDUTOR.md`, a condução foi pausada até autorização do usuário (`20:08`) e repetida tecnicamente na rodada 02 (sem contar como intervenção humana adicional). Essa pausa elevou o tempo de relógio de parede de A2 para **467 min** (soma do tempo ativo das rodadas do implementador em A2: `255 s`), distorcendo a média de tempo do grupo A (`159 ± 266,7` min; mediana `6` min).
- **Ocorrência menor em A2 (rodada 00):** o implementador reportou falha de `pkill` (código 144) ao tentar encerrar servidor manual na porta 3111; sem impacto sobre a avaliação.
- **Auditoria e isolamento:** todas as 6 execuções passaram na auditoria de isolamento (`grep -l "Harness-agentes-IA" .../*.jsonl` sem correspondências), sem nenhum commit `fix(humano)` e sem alterações na infraestrutura protegida (ver [`experimento/auditoria/log-condutor.md`](../auditoria/log-condutor.md)).
