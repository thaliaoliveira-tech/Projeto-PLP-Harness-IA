# Registro manual — execução B3 (com harness)

> Preencha durante a execução. Os números (testes, violações, rodadas, tempo, tokens) são coletados
> automaticamente pelos scripts; aqui ficam as **observações qualitativas** que só você vê.

- Preparada em: 23/11/2026, 20:23
- Pasta de trabalho: `~/projetos-leilao/B3`

## Configuração do Claude Code (confira antes de colar o prompt)

| Item | Valor |
|---|---|
| Versão da extensão / CLI | 2.1.300 (Claude Code) |
| Modelo (`/model`) | claude-sonnet-5-5 |
| Esforço (effort) | medium |
| Modo de permissão | acceptEdits (não interativo) |
| Conversa nova (sem histórico)? | sim |
| Horário em que o prompt inicial foi enviado | 23/11/2026 20:23 |

## Ocorrências durante a execução

Anote tudo o que fugir do roteiro: perguntas do agente (e a resposta padronizada que você deu),
pedidos de permissão incomuns, travamentos, comandos que o agente rodou fora da pasta,
interrupções, edições manuais etc.

| Horário | Ocorrência | O que você fez |
|---|---|---|
| — | Nenhuma ocorrência fora do roteiro (sem perguntas, sem travamentos, sem intervenções humanas). | — |

## Observações sobre o comportamento do agente

- Seguiu as instruções do harness (`AGENTS.md`/`CLAUDE.md`): estruturou `leiloes/` (`dominio`, `aplicacao`, `http`) e `notificacoes/` observando `eventos$` sem acoplamento direto, escreveu 3 arquivos de testes unitários (18 casos, cobrindo domínios de leilões e de notificações), e rodou `npm run validate` até `VALIDAÇÃO OK`, além de teste manual na porta 3456 com 5 lances simultâneos.
- Produziu arquitetura **reativa** pura desde a primeira entrega: `decidir`/`evoluir` puros, Sink privado (`Subject` + `scan`), `eventos$` com replay, encerramento com `groupBy` + `switchMap(timer)` carregando o prazo agendado conforme `docs/arquitetura.md`.
- Chamou atenção: 0 violações, 0/41 testes falhando e aprovação na 1ª entrega sem intervenções; nenhum arquivo do harness foi alterado ou removido. Conforme `harness-hooks.log`, houve 3 validações completas `ok` (`20:26:21`, `20:26:55` e `20:27:15` pelo hook `Stop`), 0 bloqueios de encerramento e 0 edições com violação.

## Impressão geral

Com o harness ativo, o implementador seguiu integralmente a arquitetura orientada a eventos, escreveu 18 testes unitários e validou com `npm run validate` e concorrência manual, sendo aprovado já no primeiro checkpoint sem intervenções humanas (US$ 0.49).
