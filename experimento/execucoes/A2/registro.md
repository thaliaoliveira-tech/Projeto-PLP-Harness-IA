# Registro manual — execução A2 (sem harness)

> Preencha durante a execução. Os números (testes, violações, rodadas, tempo, tokens) são coletados
> automaticamente pelos scripts; aqui ficam as **observações qualitativas** que só você vê.

- Preparada em: 23/11/2026, 12:23
- Pasta de trabalho: `~/projetos-leilao/A2`

## Configuração do Claude Code (confira antes de colar o prompt)

| Item | Valor |
|---|---|
| Versão da extensão / CLI | 2.1.300 (Claude Code) |
| Modelo (`/model`) | claude-sonnet-5-5 |
| Esforço (effort) | medium |
| Modo de permissão | acceptEdits (não interativo) |
| Conversa nova (sem histórico)? | sim |
| Horário em que o prompt inicial foi enviado | 23/11/2026 12:23 |

## Ocorrências durante a execução

Anote tudo o que fugir do roteiro: perguntas do agente (e a resposta padronizada que você deu),
pedidos de permissão incomuns, travamentos, comandos que o agente rodou fora da pasta,
interrupções, edições manuais etc.

| Horário | Ocorrência | O que você fez |
|---|---|---|
| 12:25 | Na rodada 00 (`inicial`), o implementador informou que o `pkill` do servidor de teste terminou com código 144 e um `node dist/main` na porta 3111 pode ter ficado ativo. | Registrado no log; nenhuma ação manual na pasta de execução (o kit usa portas próprias). |
| 12:28 | Na rodada 01 (`intervencao`), o Claude Code atingiu o limite de sessão (`429 usage_limit_reached`, reset às 14:10). | Condução pausada com segurança conforme seção 7 do roteiro; usuário escolheu aguardar liberação. |
| 20:09 | Retomada autorizada pelo usuário às 20:08. | Executada repetição técnica de `rodar-implementador.sh A2 intervencao` (rodada 02) conforme seção 7. |

## Observações sobre o comportamento do agente

- Sem harness (sem `AGENTS.md`/`CLAUDE.md`). O implementador apagou os testes de exemplo (`app.controller.spec.ts` e `app.e2e-spec.ts`), não escreveu testes automatizados (0 casos no projeto) e validou com `npm run build` + `curl` contra `node dist/main`.
- Solução produzida: inicialmente **mista** com 7 violações (1× `RX03` `Subject` público `todosEventos$`, 4× `RX04` `Map` mutável em `leilao.service.ts` e `notificacoes.service.ts`, 1× `RX02` `subscribe` fora do ciclo de vida, 1× `RX07` `LeiloesController` importando `NotificacoesService`). Após a intervenção 1, refatorou para **reativa** pura (`scan` sobre cópias imutáveis, `private readonly` + `eventos$`, `onModuleInit` com `takeUntil(destruir$)`, `groupBy`/`switchMap(timer)` e `ParticipantesController` desacoplado).
- Chamou atenção: na 1ª entrega já passou em 41/41 testes de aceitação apesar das 7 violações arquiteturais (inclusive acoplamento direto controller→notificações). Na correção, pensou até em colisão de nomes de participante como `constructor` ao usar `Map` imutável e validou esse caso manualmente.

## Impressão geral

Sem o harness, o implementador entregou toda a funcionalidade (41/41), mas violou quatro regras arquiteturais distintas (RX02, RX03, RX04 e RX07, totalizando 7 ocorrências). Com uma intervenção objetiva, refatorou completamente para o paradigma reativo sem quebrar os testes funcionais, sendo aprovado no segundo checkpoint (tempo total de relógio de parede elevado pela pausa de limite da conta: 468 min; tempo ativo de agente ~3,4 min; custo total US$ 1.50 incluindo a chamada interrompida por limite).
