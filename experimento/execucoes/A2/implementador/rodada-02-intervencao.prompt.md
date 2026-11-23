Revisei a implementação e encontrei os problemas abaixo. Corrija todos eles, mantendo os requisitos da tarefa original.

## Violações das regras de arquitetura reativa (7)

O projeto deve seguir o paradigma reativo/orientado a eventos com RxJS. Estas ocorrências violam as regras:

### RX03 — subject-exposto

Problema: Subject acessível fora da classe/módulo que o criou.

- `src/leilao.service.ts:34` — `readonly todosEventos$ = new Subject<EventoLeilao>();`

Como corrigir: Declare o Subject como "private readonly" e exponha apenas um Observable (ex.: readonly eventos$ = this.entrada$.asObservable()). Só o dono do Sink pode chamar next().

### RX04 — estado-mutavel

Problema: Estado mutado de forma imperativa (campo da classe ou variável de módulo).

- `src/leilao.service.ts:135` — `this.leiloes.set(leilao.id, estado)`
- `src/notificacoes.service.ts:22` — `this.titulos.set(ev.leilaoId, ev.dados.titulo as string)`
- `src/notificacoes.service.ts:38` — `this.lideres.set(ev.leilaoId, { participante, valor })`
- `src/notificacoes.service.ts:63` — `this.porParticipante.set(nome, lista)`

Como corrigir: Não guarde estado em campos/variáveis alterados por métodos. Derive o estado do fluxo de eventos com scan()/reduce puros e exponha-o como Observable (ex.: estado$ = eventos$.pipe(scan(evoluir, inicial), shareReplay(1))).

### RX02 — subscribe-fora-do-ciclo-de-vida

Problema: subscribe() fora do construtor/onModuleInit/onApplicationBootstrap (ou dentro de um controller).

- `src/leilao.service.ts:137` — `estado.prazo$`

Como corrigir: Controllers e métodos chamados por requisição devem DEVOLVER um Observable (o NestJS assina). Assinaturas permanentes (efeitos colaterais, projeções) ficam no onModuleInit, com takeUntil(destruir$) liberado no onModuleDestroy.

### RX07 — emissor-conhece-observador

Problema: O módulo de leilões/lances depende do módulo de notificações (o emissor chama o observador).

- `src/leiloes.controller.ts:14` — `import { NotificacoesService } from './notificacoes.service.js';`

Como corrigir: Inverta a dependência: leilões apenas publicam eventos; notificações (e qualquer outro observador) assinam o fluxo de eventos de leilões. Quem muda não deve conhecer quem reage.
