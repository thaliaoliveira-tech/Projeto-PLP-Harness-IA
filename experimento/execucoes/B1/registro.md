# Registro manual — execução B1 (com harness)

> Preencha durante a execução. Os números (testes, violações, rodadas, tempo, tokens) são coletados
> automaticamente pelos scripts; aqui ficam as **observações qualitativas** que só você vê.

- Preparada em: 23/11/2026, 12:11
- Pasta de trabalho: `~/projetos-leilao/B1`

## Configuração do Claude Code (confira antes de colar o prompt)

| Item | Valor |
|---|---|
| Versão da extensão / CLI | 2.1.300 (Claude Code) |
| Modelo (`/model`) | claude-sonnet-5-5 |
| Esforço (effort) | medium |
| Modo de permissão | acceptEdits (não interativo) |
| Conversa nova (sem histórico)? | sim |
| Horário em que o prompt inicial foi enviado | 23/11/2026 12:12 |

## Ocorrências durante a execução

Anote tudo o que fugir do roteiro: perguntas do agente (e a resposta padronizada que você deu),
pedidos de permissão incomuns, travamentos, comandos que o agente rodou fora da pasta,
interrupções, edições manuais etc.

| Horário | Ocorrência | O que você fez |
|---|---|---|
| — | Nenhuma ocorrência fora do roteiro (sem perguntas, sem travamentos, sem intervenções humanas). | — |

## Observações sobre o comportamento do agente

- Seguiu as instruções do harness (`AGENTS.md`/`CLAUDE.md`): estruturou `src/leiloes/` (`dominio/`, `aplicacao/`, `http/`) e `src/notificacoes/` respeitando `dominio-puro`, escreveu 2 arquivos de testes unitários (19 casos), e executou `npm run validate` até obter `VALIDAÇÃO OK`, além de teste manual com `node dist/main` na porta 3111.
- Produziu arquitetura puramente **reativa** desde a primeira entrega: domínio puro (`decidir`, `evoluir`, `processar`, `registrar`), Sink privado (`Subject` + `scan`), log `eventos$` com replay, temporização com `groupBy` + `switchMap(timer)` carregando o prazo agendado (mitigando a armadilha de ~1 ms antes de `Date.now()`), e notificações como observador de `eventos$`.
- Chamou atenção: 0 violações, 0/41 testes falhando e aprovação na 1ª entrega sem nenhuma intervenção humana; nenhum arquivo do harness foi alterado ou removido.

## Impressão geral

Com o harness ativo, o implementador seguiu a arquitetura orientada a eventos desde o início, escreveu testes unitários de domínio (19 casos), validou tudo com `npm run validate` e atingiu aprovação plena (41/41 testes, 0 violações) logo no primeiro checkpoint, sem necessidade de intervenção humana (5 min, US$ 0.47).
