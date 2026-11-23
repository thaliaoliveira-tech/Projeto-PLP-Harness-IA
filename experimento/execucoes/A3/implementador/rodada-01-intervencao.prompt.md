Revisei a implementação e encontrei os problemas abaixo. Corrija todos eles, mantendo os requisitos da tarefa original.

## Violações das regras de arquitetura reativa (3)

O projeto deve seguir o paradigma reativo/orientado a eventos com RxJS. Estas ocorrências violam as regras:

### RX04 — estado-mutavel

Problema: Estado mutado de forma imperativa (campo da classe ou variável de módulo).

- `src/leiloes/leiloes.service.ts:112` — `this.leiloes.set(leilao.id, reg)`
- `src/leiloes/leiloes.service.ts:251` — `this.notificacoes.set(nome, lista)`

Como corrigir: Não guarde estado em campos/variáveis alterados por métodos. Derive o estado do fluxo de eventos com scan()/reduce puros e exponha-o como Observable (ex.: estado$ = eventos$.pipe(scan(evoluir, inicial), shareReplay(1))).

### RX02 — subscribe-fora-do-ciclo-de-vida

Problema: subscribe() fora do construtor/onModuleInit/onApplicationBootstrap (ou dentro de um controller).

- `src/leiloes/leiloes.service.ts:209` — `timer(delay).subscribe(() => {`

Como corrigir: Controllers e métodos chamados por requisição devem DEVOLVER um Observable (o NestJS assina). Assinaturas permanentes (efeitos colaterais, projeções) ficam no onModuleInit, com takeUntil(destruir$) liberado no onModuleDestroy.
