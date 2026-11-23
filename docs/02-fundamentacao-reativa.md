# 2. Fundamentação: programação reativa / orientada a eventos

Conceitos dos slides *Paradigma Orientado a Eventos — Programação Reativa* (Prof. Thiago de Sales)
e onde cada um aparece neste trabalho.

## Do imperativo ao reativo

Os slides partem do caso **Carrinho → Fatura**: no estilo imperativo/passivo, o carrinho é
*proativo* ("este muda esse") e chama setters remotos na fatura, que é *passiva* e nem sabe que
depende do carrinho. Gerenciar esse estado é "exponencialmente complexo" (cada booleano dobra o
número de estados).

No estilo **reativo**, o módulo que muda apenas **emite eventos**; quem depende dele **observa** e
se atualiza sozinho. "O módulo que está sendo alterado é o responsável por definir a mudança."

Neste trabalho o par equivalente é **Leilões → Notificações** (e também leilões → estado, histórico, SSE):

| Imperativo (anti-gabarito) | Reativo (gabarito / harness) |
|---|---|
| `LeiloesService` guarda `Map<string, Leilao>` e altera campos (`leilao.maiorLance = ...`) | o estado é **derivado** do fluxo de eventos com `scan` |
| ao aceitar um lance, chama `notificacoesService.adicionar(...)` | notificações **assinam** `eventos$` e reagem sozinhas |
| `setTimeout` para encerrar; `clearTimeout` ao prorrogar | o tempo é um fluxo: `switchMap(prazo => timer(prazo))` |
| `Subject` público usado como barramento | `Subject` privado (Sink); só `Observable` é exposto |
| controller assina o Subject manualmente para o SSE | controller **devolve** um `Observable` (o NestJS assina) |

Os dois arquivos completos estão em `avaliacao/anti-gabarito/src/` e `avaliacao/referencia/src/`
e são bons exemplos para os slides (mesma funcionalidade, mesmos 41 testes passando, paradigmas opostos).

## Padrão Observer

"Relação de um para muitos: Sujeito (observável) — Observadores." Aqui o sujeito é o **log de
eventos dos leilões** (`eventos$`) e os observadores são: a projeção de estado, o temporizador de
encerramento, o módulo de notificações e cada cliente conectado ao stream SSE.

## Data stream: Sink, Stream, Controller, Listeners

| Slide | Neste projeto |
|---|---|
| **Sink** (entrada: valores, eventos, objetos, erros) | `private readonly entrada$ = new Subject<Entrada>()` — comandos vindos do HTTP e do temporizador |
| **Controller** do stream | `LeiloesService`, o único que chama `entrada$.next(...)` |
| **Stream** | `processamento$` → `eventos$` (log de eventos com replay) |
| **Listeners** | `estado$`, notificações, temporizador, SSE |
| **Filter** (operadores) | `filter(e => e.leilaoId === id)`, `takeWhile(...)` |
| **Transforms** (operadores) | `scan(processar)`, `map`, `concatMap`, `groupBy`, `switchMap` |
| `StreamBuilder` (Flutter) | o endpoint SSE `GET /leiloes/:id/stream`: a "view" que reage a cada evento |

## CRIE · COMBINE · OUÇA

O resumo dos slides vira o esqueleto da arquitetura exigida pelo harness:

1. **Crie** streams de eventos e dados → comandos entram pelo Sink; o processamento emite eventos.
2. **Combine** com operadores → `scan` (estado), `groupBy` + `switchMap` + `timer` (prazos que mudam),
   `filter` + `takeWhile` (stream de um leilão que termina sozinho).
3. **Ouça** para efeitos colaterais → notificações, SSE, realimentação do encerramento.

## Características principais (e como o harness as exige)

| Característica (slides) | Regra/artefato do harness |
|---|---|
| **Funcional**: evitar estado, funções de entrada/saída sobre streams | RX04 (estado mutável), RX08 (redutor puro), camada `dominio/` pura |
| **Menos é mais**: operadores fazem muito com pouco código | padrões em `docs/arquitetura.md` |
| **Tratamento de erros assíncronos** | controllers devolvem `Observable`; erros viram respostas HTTP |
| **Concorrência fácil** | `scan` processa um comando por vez — o teste de 20 lances simultâneos verifica |

## Relação com a disciplina (Paradigmas de Linguagens)

A Aula 1 lista a **programação orientada a agentes** e a **manipulação de eventos** entre as
categorias especiais de linguagens/paradigmas. Este trabalho combina as duas: um agente de IA
programando no paradigma orientado a eventos, e o harness como forma de impor o paradigma.

Próximo: [3. O sistema de leilões](03-sistema-leilao.md).
