Revisei a implementação e encontrei os problemas abaixo. Corrija todos eles, mantendo os requisitos da tarefa original.

## Violações das regras de arquitetura reativa (12)

O projeto deve seguir o paradigma reativo/orientado a eventos com RxJS. Estas ocorrências violam as regras:

### RX02 — subscribe-fora-do-ciclo-de-vida

Problema: subscribe() fora do construtor/onModuleInit/onApplicationBootstrap (ou dentro de um controller).

- `src/leiloes/leiloes.controller.ts:77` — `this.service.eventos$.subscribe((e) => {`

Como corrigir: Controllers e métodos chamados por requisição devem DEVOLVER um Observable (o NestJS assina). Assinaturas permanentes (efeitos colaterais, projeções) ficam no onModuleInit, com takeUntil(destruir$) liberado no onModuleDestroy.

### RX07 — emissor-conhece-observador

Problema: O módulo de leilões/lances depende do módulo de notificações (o emissor chama o observador).

- `src/leiloes/leiloes.module.ts:2` — `import { NotificacoesModule } from '../notificacoes/notificacoes.module.js';`
- `src/leiloes/leiloes.service.ts:5` — `import { NotificacoesService } from '../notificacoes/notificacoes.service.js';`

Como corrigir: Inverta a dependência: leilões apenas publicam eventos; notificações (e qualquer outro observador) assinam o fluxo de eventos de leilões. Quem muda não deve conhecer quem reage.

### RX03 — subject-exposto

Problema: Subject acessível fora da classe/módulo que o criou.

- `src/leiloes/leiloes.service.ts:44` — `readonly eventos$ = new Subject<Evento>();`

Como corrigir: Declare o Subject como "private readonly" e exponha apenas um Observable (ex.: readonly eventos$ = this.entrada$.asObservable()). Só o dono do Sink pode chamar next().

### RX04 — estado-mutavel

Problema: Estado mutado de forma imperativa (campo da classe ou variável de módulo).

- `src/leiloes/leiloes.service.ts:69` — `this.leiloes.set(id, leilao)`
- `src/leiloes/leiloes.service.ts:70` — `this.eventos.set(id, [])`
- `src/leiloes/leiloes.service.ts:159` — `this.timers.set(id, setTimeout(() => this.encerrar(id), ms))`
- `src/leiloes/leiloes.service.ts:168` — `this.timers.delete(id)`
- `src/notificacoes/notificacoes.service.ts:13` — `this.porParticipante.set(participante, lista)`

Como corrigir: Não guarde estado em campos/variáveis alterados por métodos. Derive o estado do fluxo de eventos com scan()/reduce puros e exponha-o como Observable (ex.: estado$ = eventos$.pipe(scan(evoluir, inicial), shareReplay(1))).

### RX05 — temporizador-imperativo

Problema: Uso de setTimeout/setInterval/setImmediate (ou node:timers).

- `src/leiloes/leiloes.service.ts:157` — `clearTimeout(this.timers.get(id))`
- `src/leiloes/leiloes.service.ts:159` — `setTimeout(() => this.encerrar(id), ms)`
- `src/leiloes/leiloes.service.ts:167` — `clearTimeout(this.timers.get(id))`

Como corrigir: Modele o tempo como fluxo: timer(), interval(), delay(), debounceTime()... Para reagendar um prazo que pode mudar, use switchMap(prazo => timer(prazo)).
