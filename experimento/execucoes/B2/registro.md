# Registro manual — execução B2 (com harness)

> Preencha durante a execução. Os números (testes, violações, rodadas, tempo, tokens) são coletados
> automaticamente pelos scripts; aqui ficam as **observações qualitativas** que só você vê.

- Preparada em: 23/11/2026, 12:17
- Pasta de trabalho: `~/projetos-leilao/B2`

## Configuração do Claude Code (confira antes de colar o prompt)

| Item | Valor |
|---|---|
| Versão da extensão / CLI | 2.1.300 (Claude Code) |
| Modelo (`/model`) | claude-sonnet-5-5 |
| Esforço (effort) | medium |
| Modo de permissão | acceptEdits (não interativo) |
| Conversa nova (sem histórico)? | sim |
| Horário em que o prompt inicial foi enviado | 23/11/2026 12:18 |

## Ocorrências durante a execução

Anote tudo o que fugir do roteiro: perguntas do agente (e a resposta padronizada que você deu),
pedidos de permissão incomuns, travamentos, comandos que o agente rodou fora da pasta,
interrupções, edições manuais etc.

| Horário | Ocorrência | O que você fez |
|---|---|---|
| — | Nenhuma ocorrência fora do roteiro (sem perguntas, sem travamentos, sem intervenções humanas). | — |

## Observações sobre o comportamento do agente

- Seguiu as instruções do harness (`AGENTS.md`/`CLAUDE.md`): organizou `leiloes/` (`dominio`, `aplicacao`, `http`) e `notificacoes/` observando `eventos$` sem acoplamento direto, escreveu 3 arquivos de testes unitários (23 casos, cobrindo domínio dos dois módulos e validação), e rodou `npm run validate` até `VALIDAÇÃO OK` além de verificação manual via `curl` na porta 3456.
- Produziu arquitetura **reativa** pura desde a primeira entrega: `decidir`/`evoluir` puros, Sink privado (`Subject` + `scan`), `eventos$` com replay, temporizador com `groupBy` + `switchMap(timer)` carregando o prazo agendado (mitigando a armadilha de ~1 ms antes de `Date.now()`).
- Chamou atenção: 0 violações, 0/41 testes falhando e aprovação na 1ª entrega sem intervenções; corrigiu por conta própria uma expectativa equivocada nos próprios testes unitários de notificações (caso de quem é superado e depois vence) após `npm run validate` apontar falha em `testes-unitarios` (`harness-hooks.log`: `12:20:20 validate falhou testes-unitarios`, seguido de `12:20:33 validate ok` e `12:21:04 stop liberado (validação ok)`).

## Impressão geral

Com o harness ativo, o implementador produziu uma arquitetura reativa limpa, escreveu 23 testes unitários e validou com `npm run validate`, obtendo aprovação plena (41/41 testes, 0 violações) já no primeiro checkpoint sem intervenções humanas (4 min, US$ 0.47).
