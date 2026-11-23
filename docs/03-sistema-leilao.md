# 3. O sistema: API de leilões em tempo real

A especificação completa — exatamente o texto entregue ao agente nas duas condições — está em
[`experimento/prompts/tarefa.md`](../experimento/prompts/tarefa.md). Este documento resume e explica
por que esse domínio foi escolhido.

## Funcionalidades

| Funcionalidade | Endpoint | Aspecto reativo exercitado |
|---|---|---|
| Criar, listar e consultar leilões | `POST /leiloes`, `GET /leiloes`, `GET /leiloes/:id` | estado como projeção do log |
| Dar lance (com validações e ordem de regras) | `POST /leiloes/:id/lances` | comandos → eventos; processamento sequencial |
| Histórico de eventos | `GET /leiloes/:id/eventos` | log de eventos como fonte da verdade |
| Acompanhar em tempo real | `GET /leiloes/:id/stream` (SSE) | stream com replay que **termina sozinho** |
| Notificações por participante | `GET /participantes/:nome/notificacoes` | observador independente (Observer) |
| Encerramento automático | — | o tempo como fluxo (`timer`) |
| Prorrogação anti-sniping | — | prazo que muda → `switchMap` cancela o temporizador anterior |
| Lances simultâneos | — | consistência sob concorrência |

## Eventos do domínio

`LeilaoCriado` → `LanceAceito` / `LanceRejeitado` → `LeilaoProrrogado` → `LeilaoEncerrado`
(sempre o último). Cada evento tem `sequencia` (1, 2, 3... sem buracos), `tipo`, `leilaoId`,
`ocorridoEm` e `dados`.

## Por que leilão?

- **Tudo é evento**: lance recebido, aceito, rejeitado, prorrogação, encerramento.
- **Tem tempo** (encerramento automático e prorrogação): é onde o estilo imperativo mais se complica
  (`setTimeout`/`clearTimeout`) e onde os operadores reativos brilham (`switchMap(timer)`).
- **Tem observadores naturais** (notificações, SSE): o caso "Carrinho → Fatura" dos slides.
- **Tem concorrência** (lances simultâneos): mostra a vantagem de processar comandos em fluxo.
- **É testável de fora**: tudo é verificável por HTTP, sem depender de como o código foi escrito.
- **Tamanho certo**: cabe numa sessão de agente (~800 linhas no gabarito), mas tem regras de negócio
  suficientes para o agente errar.

## Arquitetura do gabarito (implementação de referência)

O gabarito (`avaliacao/referencia/src/`) segue a arquitetura que o harness pede e serve para
provar que ela é implementável e que os testes estão corretos:

```
src/
├── app.module.ts / main.ts
├── leiloes/
│   ├── dominio/tipos.ts       eventos, comandos, estado (só tipos)
│   ├── dominio/regras.ts      decidir(estado, comando, instante) e evoluir(estado, evento) — puras
│   ├── aplicacao/leiloes.service.ts   Sink + scan + log de eventos + projeções + temporizador
│   └── http/                  controller + validação de entrada
└── notificacoes/
    ├── dominio/notificacoes.ts         redutor puro eventos → notificações
    ├── aplicacao/notificacoes.service.ts   observa eventos$ de leilões
    └── http/notificacoes.controller.ts
```

Próximo: [4. O harness](04-harness.md).
