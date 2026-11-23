# Registro manual — execução B1 (com harness)

> Preencha durante a execução. Os números (testes, violações, rodadas, tempo, tokens) são coletados
> automaticamente pelos scripts; aqui ficam as **observações qualitativas** que só você vê.

- Preparada em: 23/11/2026, 11:37
- Pasta de trabalho: `~/projetos-leilao/B1`

## Configuração do Claude Code (confira antes de colar o prompt)

| Item | Valor |
|---|---|
| Versão da extensão / CLI | |
| Modelo (`/model`) | |
| Esforço (effort) | |
| Modo de permissão | |
| Conversa nova (sem histórico)? | sim / não |
| Horário em que o prompt inicial foi enviado | |

## Ocorrências durante a execução

Anote tudo o que fugir do roteiro: perguntas do agente (e a resposta padronizada que você deu),
pedidos de permissão incomuns, travamentos, comandos que o agente rodou fora da pasta,
interrupções, edições manuais etc.

| Horário | Ocorrência | O que você fez |
|---|---|---|
| | | |

## Observações sobre o comportamento do agente

- Seguiu as instruções do projeto (AGENTS.md / CLAUDE.md)? Rodou a validação por conta própria?
- Que tipo de solução produziu (reativa? imperativa? mista)?
- O que mais chamou sua atenção (bom ou ruim)?

## Impressão geral

(2–3 frases para usar no relatório)

## ⚠ Ressalva de validade (preenchido por Claude, que conduziu esta execução)

Esta execução NÃO é independente. Quem a executou foi o mesmo agente que construiu o harness, o
gabarito e o kit na mesma conversa, e já tinha a solução de referência em contexto (a implementação
foi reescrita, não copiada, mas segue a mesma arquitetura). Além disso, a sessão não ocorreu na
pasta da execução, então não há transcrição própria (`sessao/`) e as métricas de processo
(tokens, chamadas de ferramenta) não valem. O modelo era Sonnet 5.5, não o de A1.
Fluxo real: escreveu o código, `npm run validate` falhou 1× (E02: faltavam testes unitários do
domínio, apontado pelo harness), corrigiu e passou; entrega aprovada sem intervenção do kit.
Uso válido: demonstração do fluxo e do harness; NÃO usar como dado da comparação A × B.
