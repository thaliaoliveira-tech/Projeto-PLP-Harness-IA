# Relatório da execução A2 (sem harness)

## Resumo
- Status final: aprovada
- Primeira entrega: build ok, 0/41 testes falhando, 7 violações (`RX02=1, RX03=1, RX04=4, RX07=1`)
- Intervenções: 1 (prompts de correção: 1; perguntas/continuar: 0; houve 1 repetição técnica da intervenção após erro 429 de limite de sessão)
- Tempo: 467 min (inclui pausa de ~7 h 40 min aguardando reset do limite de sessão do Claude Code entre 12:28 e 20:08; soma das rodadas do implementador: 255 s) · Custo do implementador: US$ 1.50

## Linha do tempo

| Checkpoint | Horário | Build | Testes falhando | Violações | O que foi enviado em seguida |
|---|---|---|---|---|---|
| 1 (`entrega`, `912f6956`) | 23/11/2026 12:25 | ok | 0/41 | 7 (`RX02=1, RX03=1, RX04=4, RX07=1`) | `checkpoints/01-entrega/intervencao.md` (1ª tentativa às 12:25 atingiu limite 429; repetição técnica às 20:09) |
| 2 (`correcao`, `88d93ba0`) | 23/11/2026 20:10 | ok | 0/41 | 0 | — (aprovada) |

## O que deu errado e como foi corrigido

- **Checkpoint 1 (`entrega`)**: todos os 41 testes de aceitação passaram logo na primeira entrega, mas o verificador apontou **7 violações** das regras reativas (em `checkpoints/01-entrega/intervencao.md`):
  - **RX03 (`subject-exposto`, 1 ocorrência)**: `src/leilao.service.ts:34` (`readonly todosEventos$ = new Subject<EventoLeilao>();`).
  - **RX04 (`estado-mutavel`, 4 ocorrências)**: `src/leilao.service.ts:135` (`this.leiloes.set(...)`), `src/notificacoes.service.ts:22` (`this.titulos.set(...)`), `:38` (`this.lideres.set(...)`) e `:63` (`this.porParticipante.set(...)`).
  - **RX02 (`subscribe-fora-do-ciclo-de-vida`, 1 ocorrência)**: `src/leilao.service.ts:137` (`estado.prazo$`).
  - **RX07 (`emissor-conhece-observador`, 1 ocorrência)**: `src/leiloes.controller.ts:14` (`import { NotificacoesService } from './notificacoes.service.js';`).
- **Correção (`912f6956` → `88d93ba0`)**: o implementador alterou `src/app.module.ts`, `src/leilao.service.ts`, `src/leiloes.controller.ts`, `src/notificacoes.service.ts` e criou `src/participantes.controller.ts` (`+493/-280` linhas). Tornou `comando$` e `destruir$` `private readonly`, derivou o estado de leilões e notificações via `scan` puro sobre cópias imutáveis de `Map`, moveu as assinaturas para `onModuleInit` com `takeUntil(destruir$)` (usando `groupBy` + `switchMap(timer)` nos prazos) e separou a rota de participantes em `ParticipantesController`, deixando `NotificacoesService` observar `LeilaoService.eventos$`.

## Comportamento do agente
- Sem harness (sem `AGENTS.md`/`CLAUDE.md`). Removeu os testes de exemplo (`app.controller.spec.ts` e `app.e2e-spec.ts`), não escreveu testes automatizados (0 casos no projeto) e validou com `npm run build` e sessões manuais de `curl` contra `node dist/main`.
- Produziu inicialmente uma arquitetura **mista** com 7 violações (Subjects expostos, `Map` mutável em serviços, `.subscribe()` fora do ciclo de vida e controller de leilões acoplado a notificações); após a intervenção 1, migrou para arquitetura **reativa** pura (0/41 testes falhando, 0 violações).
- Ocorrências registradas: (1) na rodada 00, um `pkill` falhou (código 144) deixando possível processo `node dist/main` na porta 3111; (2) na rodada 01 (`12:25–12:28`), o Claude Code atingiu limite de sessão (`429 usage_limit_reached`), exigindo pausa até liberação pelo usuário (`20:08`) e repetição técnica na rodada 02.

## Auditoria
- Isolamento (grep da seção 5.6): ok (`grep -l "Harness-agentes-IA" experimento/execucoes/A2/sessao/*.jsonl` sem correspondências)
- Desvios do roteiro: nenhum (pausa e repetição técnica seguiram integralmente a seção 7)

## Evidências
- Ramo: `execucoes/A2` (tags `execucoes/A2/entrega` e `execucoes/A2/final`)
- Checkpoints: [`checkpoints/`](checkpoints/)
- Chamadas do implementador: [`implementador/log.md`](implementador/log.md)
- Resumo automático: [`resumo.md`](resumo.md)
