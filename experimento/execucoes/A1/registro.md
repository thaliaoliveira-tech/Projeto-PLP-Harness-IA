# Registro manual — execução A1 (sem harness)

> Preencha durante a execução. Os números (testes, violações, rodadas, tempo, tokens) são coletados
> automaticamente pelos scripts; aqui ficam as **observações qualitativas** que só você vê.

- Preparada em: 23/11/2026, 12:04
- Pasta de trabalho: `~/projetos-leilao/A1`

## Configuração do Claude Code (confira antes de colar o prompt)

| Item | Valor |
|---|---|
| Versão da extensão / CLI | 2.1.300 (Claude Code) |
| Modelo (`/model`) | claude-sonnet-5-5 |
| Esforço (effort) | medium |
| Modo de permissão | acceptEdits (não interativo) |
| Conversa nova (sem histórico)? | sim |
| Horário em que o prompt inicial foi enviado | 23/11/2026 12:04 |

## Ocorrências durante a execução

Anote tudo o que fugir do roteiro: perguntas do agente (e a resposta padronizada que você deu),
pedidos de permissão incomuns, travamentos, comandos que o agente rodou fora da pasta,
interrupções, edições manuais etc.

| Horário | Ocorrência | O que você fez |
|---|---|---|
| — | Nenhuma ocorrência fora do roteiro (sem perguntas, sem travamentos, sem comandos `continuar`). | — |

## Observações sobre o comportamento do agente

- Sem harness (sem `AGENTS.md`/`CLAUDE.md`). O implementador rodou `npm run build` e testou manualmente com servidor real (`node dist/main`) e `curl` nas duas rodadas, mas removeu os testes de exemplo do Nest (`app.controller.spec.ts` e `test/app.e2e-spec.ts`) e não escreveu testes automatizados.
- Solução produzida: inicialmente **mista** (usava `Subject` + `concatMap` e `switchMap(timer)`, porém mantinha `Map` mutável em campos da classe, `subs.add` e `.subscribe()` por leilão — 4 violações: 3× RX04, 1× RX02); após a intervenção 1, refatorou para **reativa** (`comandos$.pipe(scan(reduzir, inicial), ...)` e assinatura única em `onModuleInit`/`onModuleDestroy`), atingindo 0 violações.
- Chamou atenção: na 1ª entrega já atingiu 41/41 nos testes de aceitação ocultos e reconheceu explicitamente no resumo o que não executou (`npm test`, `test:e2e`, `start:prod`). Na correção, manteve apenas um `firstValueFrom` no controller (`stream()`) para retornar 404 antes dos cabeçalhos SSE, decisão que justificou na resposta.

## Impressão geral

O implementador resolveu corretamente toda a funcionalidade da API logo na primeira entrega (41/41), mas misturou estado mutável em `Map` e assinaturas por instância no serviço (4 violações RX02/RX04). Com uma única intervenção objetiva apontando as violações, reescreveu `src/leilao.service.ts` para estado derivado via `scan()` e ciclo de vida único, sendo aprovado no segundo checkpoint (total de 5 min e US$ 0.68).
