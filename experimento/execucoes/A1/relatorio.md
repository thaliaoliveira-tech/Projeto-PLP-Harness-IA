# Relatório da execução A1 (sem harness)

## Resumo
- Status final: aprovada
- Primeira entrega: build ok, 0/41 testes falhando, 4 violações (`RX02=1, RX04=3`)
- Intervenções: 1 (prompts de correção: 1; perguntas/continuar: 0)
- Tempo: 4 min · Custo do implementador: US$ 0.68

## Linha do tempo

| Checkpoint | Horário | Build | Testes falhando | Violações | O que foi enviado em seguida |
|---|---|---|---|---|---|
| 1 (`entrega`, `9e67dd8c`) | 23/11/2026 12:06 | ok | 0/41 | 4 (`RX02=1, RX04=3`) | `checkpoints/01-entrega/intervencao.md` |
| 2 (`correcao`, `7f6b927b`) | 23/11/2026 12:09 | ok | 0/41 | 0 | — (aprovada) |

## O que deu errado e como foi corrigido

- **Checkpoint 1 (`entrega`)**: todos os 41 testes de aceitação passaram logo na entrega inicial, porém o verificador arquitetural apontou **4 violações** (citadas em `checkpoints/01-entrega/intervencao.md`):
  - **RX04 (`estado-mutavel`, 3 ocorrências)**: `src/leilao.service.ts:95` (`this.registros.set(leilao.id, r)`), `src/leilao.service.ts:98` (`this.subs.add(`) e `src/leilao.service.ts:285` (`this.notificacoes.set(nome, lista)`).
  - **RX02 (`subscribe-fora-do-ciclo-de-vida`, 1 ocorrência)**: `src/leilao.service.ts:99` (`r.agendar$` assinado dinamicamente ao criar cada leilão).
- **Correção (`9e67dd8c` → `7f6b927b`)**: o implementador reescreveu `src/leilao.service.ts` (e ajustou `src/leilao.controller.ts` para retornar `Observable` nos endpoints, mantendo `firstValueFrom` apenas em `stream()` para responder 404 antes dos cabeçalhos SSE). Todo o estado passou a ser derivado de `comandos$.pipe(scan(reduzir, ESTADO_INICIAL), ...)` sobre cópias imutáveis (`ReadonlyMap`), e o agendamento de prazos passou a usar uma única assinatura em `onModuleInit` (com `takeUntil(destruir$)` liberado em `onModuleDestroy`) via `distinctUntilChanged` + `switchMap(timer)`.

## Comportamento do agente
- Sem harness (sem `AGENTS.md`/`CLAUDE.md`). O implementador removeu os arquivos de exemplo do Nest (`app.controller.ts`, `app.service.ts`, `app.controller.spec.ts`, `test/app.e2e-spec.ts`), não escreveu testes automatizados (0 casos de teste no projeto; 1 execução de teste registrada na sessão) e validou manualmente subindo `node dist/main` e disparando chamadas `curl`.
- Produziu inicialmente uma arquitetura **mista** (fila de comandos com `Subject` + `concatMap` e `switchMap(timer)` por leilão, mas com estado mutável em `Map` e `.subscribe()` por instância). Após a única intervenção, migrou integralmente para arquitetura **reativa**, zerando as violações (0/41 testes falhando, 0 violações, 0 erros de tipo, 0 erros de lint).

## Auditoria
- Isolamento (grep da seção 5.6): ok (`grep -l "Harness-agentes-IA" experimento/execucoes/A1/sessao/*.jsonl` sem correspondências)
- Desvios do roteiro: nenhum

## Evidências
- Ramo: `execucoes/A1` (tags `execucoes/A1/entrega` e `execucoes/A1/final`)
- Checkpoints: [`checkpoints/`](checkpoints/)
- Chamadas do implementador: [`implementador/log.md`](implementador/log.md)
- Resumo automático: [`resumo.md`](resumo.md)
