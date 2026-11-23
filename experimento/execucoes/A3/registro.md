# Registro manual — execução A3 (sem harness)

> Preencha durante a execução. Os números (testes, violações, rodadas, tempo, tokens) são coletados
> automaticamente pelos scripts; aqui ficam as **observações qualitativas** que só você vê.

- Preparada em: 23/11/2026, 20:13
- Pasta de trabalho: `~/projetos-leilao/A3`

## Configuração do Claude Code (confira antes de colar o prompt)

| Item | Valor |
|---|---|
| Versão da extensão / CLI | 2.1.300 (Claude Code) |
| Modelo (`/model`) | claude-sonnet-5-5 |
| Esforço (effort) | medium |
| Modo de permissão | acceptEdits (não interativo) |
| Conversa nova (sem histórico)? | sim |
| Horário em que o prompt inicial foi enviado | 23/11/2026 20:13 |

## Ocorrências durante a execução

Anote tudo o que fugir do roteiro: perguntas do agente (e a resposta padronizada que você deu),
pedidos de permissão incomuns, travamentos, comandos que o agente rodou fora da pasta,
interrupções, edições manuais etc.

| Horário | Ocorrência | O que você fez |
|---|---|---|
| — | Nenhuma ocorrência fora do roteiro (sem perguntas, sem travamentos, sem repetições técnicas). | — |

## Observações sobre o comportamento do agente

- Sem harness (sem `AGENTS.md`/`CLAUDE.md`). Diferentemente de A1 e A2, o implementador manteve testes automatizados: escreveu 4 testes e2e em `test/leiloes.e2e-spec.ts` (rodando `npm run test:e2e`), além de `npm run build`, `npm run lint` e verificação com `npm run start:prod` na porta 3456.
- Solução produzida: inicialmente **mista** (usava `Subject` + `concatMap` para lances, mas mantinha `Map` mutável em `this.leiloes` e `this.notificacoes` e usava `timer(delay).subscribe(...)` por leilão — 3 violações: 2× `RX04` e 1× `RX02`). Após a intervenção 1, extraiu domínio puro para `src/leiloes/leiloes.dominio.ts` (`decidir(estado, comando)`), derivou estado e notificações via `scan` + `shareReplay(1)` e moveu as 2 assinaturas para `onModuleInit` com `takeUntil(destruir$)` e `groupBy`/`switchMap(timer)` carregando o `encerraEm` agendado.
- Chamou atenção: na 1ª entrega já passou em 41/41 testes de aceitação; na correção, adotou por iniciativa própria o padrão de domínio puro separado (`leiloes.dominio.ts`) e prazo agendado no comando `ENCERRAR` para evitar encerramento prematuro após prorrogação.

## Impressão geral

Mesmo escrevendo testes e2e próprios e passando nos 41/41 testes de aceitação na primeira entrega, o implementador sem harness incorreu em estado mutável (`Map`) e `timer().subscribe()` fora do ciclo de vida (3 violações RX02/RX04). Com uma intervenção objetiva, refatorou a solução para domínio puro e estado derivado via `scan()`, alcançando aprovação plena no segundo checkpoint (8 min, US$ 0.76).
