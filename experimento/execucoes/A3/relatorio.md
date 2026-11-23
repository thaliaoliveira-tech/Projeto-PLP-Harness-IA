# Relatório da execução A3 (sem harness)

## Resumo
- Status final: aprovada
- Primeira entrega: build ok, 0/41 testes falhando, 3 violações (`RX02=1, RX04=2`)
- Intervenções: 1 (prompts de correção: 1; perguntas/continuar: 0)
- Tempo: 6 min · Custo do implementador: US$ 0.76

## Linha do tempo

| Checkpoint | Horário | Build | Testes falhando | Violações | O que foi enviado em seguida |
|---|---|---|---|---|---|
| 1 (`entrega`, `27ced693`) | 23/11/2026 20:17 | ok | 0/41 | 3 (`RX02=1, RX04=2`) | `checkpoints/01-entrega/intervencao.md` |
| 2 (`correcao`, `76e955a8`) | 23/11/2026 20:21 | ok | 0/41 | 0 | — (aprovada) |

## O que deu errado e como foi corrigido

- **Checkpoint 1 (`entrega`)**: todos os 41 testes de aceitação passaram logo na primeira entrega, mas o verificador apontou **3 violações** (em `checkpoints/01-entrega/intervencao.md`):
  - **RX04 (`estado-mutavel`, 2 ocorrências)**: `src/leiloes/leiloes.service.ts:112` (`this.leiloes.set(leilao.id, reg)`) e `src/leiloes/leiloes.service.ts:251` (`this.notificacoes.set(nome, lista)`).
  - **RX02 (`subscribe-fora-do-ciclo-de-vida`, 1 ocorrência)**: `src/leiloes/leiloes.service.ts:209` (`timer(delay).subscribe(() => {`).
- **Correção (`27ced693` → `76e955a8`)**: o implementador criou `src/leiloes/leiloes.dominio.ts` (215 linhas) e refatorou `src/leiloes/leiloes.service.ts` (`+345/-240` linhas no total). Extraiu toda a lógica de validação, lances, prorrogação, encerramento e notificações para a função pura `decidir(estado, comando)`, derivou o estado em `LeiloesService` com `scan` + `shareReplay(1)` sobre cópias imutáveis, e moveu as duas assinaturas (estado e encerramento automático via `groupBy` + `switchMap(timer)` com `encerraEm` no comando `ENCERRAR`) para `onModuleInit` com `takeUntil(destruir$)` liberado em `onModuleDestroy`.

## Comportamento do agente
- Sem harness (sem `AGENTS.md`/`CLAUDE.md`). Ao contrário de A1 e A2, escreveu uma suíte e2e própria (`test/leiloes.e2e-spec.ts`, 4 casos) e validou com `npm run build`, `npm run lint`, `npm run test:e2e` e servidor real via `npm run start:prod` na porta 3456.
- Produziu inicialmente uma arquitetura **mista** (fila de comandos com `Subject` + `concatMap`, mas `Map` mutável em campos da classe e `timer().subscribe()` por leilão). Após a intervenção 1, migrou para arquitetura **reativa** com domínio puro separado (`leiloes.dominio.ts`), obtendo 0/41 testes falhando e 0 violações.

## Auditoria
- Isolamento (grep da seção 5.6): ok (`grep -l "Harness-agentes-IA" experimento/execucoes/A3/sessao/*.jsonl` sem correspondências)
- Desvios do roteiro: nenhum

## Evidências
- Ramo: `execucoes/A3` (tags `execucoes/A3/entrega` e `execucoes/A3/final`)
- Checkpoints: [`checkpoints/`](checkpoints/)
- Chamadas do implementador: [`implementador/log.md`](implementador/log.md)
- Resumo automático: [`resumo.md`](resumo.md)
