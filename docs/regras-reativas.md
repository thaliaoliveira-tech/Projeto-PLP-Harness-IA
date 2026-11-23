# Regras reativas (RX01–RX09)

Verificadas por `npm run regras` (`scripts/verificar-reatividade.mjs`, análise estática com a API do
compilador TypeScript) em todos os arquivos `.ts` de `src/`, exceto testes. Também rodam
automaticamente após cada edição (hook do Claude Code) e dentro de `npm run validate`.

## RX01 — subscribe-aninhado

Assinar um Observable dentro do `subscribe` de outro (ou dentro de um operador) cria assinaturas
que ninguém cancela e perde a composição.

```ts
// ❌
this.pedidos$.subscribe((p) => this.precos$.subscribe((preco) => calcular(p, preco)));
this.ids$.pipe(map((id) => this.buscar(id).subscribe())).subscribe();
// ✅
this.pedidos$.pipe(switchMap((p) => this.precos$.pipe(map((preco) => calcular(p, preco)))));
```

## RX02 — subscribe-fora-do-ciclo-de-vida

`subscribe` só é permitido no **construtor**, no **`onModuleInit`** / **`onApplicationBootstrap`**
ou na inicialização de um campo. Controllers e métodos chamados a cada requisição **devolvem**
`Observable` (o NestJS assina e cancela por você).

```ts
// ❌ (assinatura criada a cada requisição, nunca cancelada)
@Get(':id') ler(@Param('id') id: string) {
  let r; this.servico.estado$.subscribe((e) => (r = e.get(id))); return r;
}
// ✅
@Get(':id') ler(@Param('id') id: string): Observable<Item> {
  return this.servico.estado$.pipe(take(1), map((e) => e.get(id)));
}
```

## RX03 — subject-exposto

Um `Subject` é a **entrada** (Sink) de um fluxo. Se ele é público, qualquer módulo pode emitir
eventos falsos. Exponha apenas `Observable`.

```ts
// ❌
readonly eventos$ = new Subject<Evento>();
export const barramento = new Subject<Evento>();
// ✅
private readonly entrada$ = new Subject<Evento>();
readonly eventos$ = this.entrada$.asObservable();
```

## RX04 — estado-mutavel

Campos de classe e variáveis de módulo alterados por métodos são o estilo **imperativo/passivo**
("o carrinho chama `fatura.atualizaTotal()`"). Aqui o estado é **derivado** do fluxo de eventos.
Atribuições a `this.x` só são aceitas no construtor e nos ganchos de ciclo de vida.

```ts
// ❌
private leiloes = new Map<string, Leilao>();
darLance(...) { this.leiloes.get(id)!.maiorLance = lance; this.total++; }
// ✅
readonly estado$ = this.eventos$.pipe(scan(evoluir, ESTADO_INICIAL), shareReplay(1));
```

> Limitação conhecida: o verificador não segue apelidos (`const l = this.mapa.get(id); l.x = 1`).
> A regra continua valendo mesmo quando não é detectada.

## RX05 — temporizador-imperativo

`setTimeout`/`setInterval` escondem o tempo fora do fluxo e exigem cancelamento manual.

```ts
// ❌
clearTimeout(this.timers.get(id));
this.timers.set(id, setTimeout(() => this.encerrar(id), ms));
// ✅
prazos$.pipe(switchMap((prazo) => timer(new Date(prazo))))   // novo prazo cancela o anterior
```

## RX06 — eventos-fora-do-rxjs

`EventEmitter` (Node), `@nestjs/event-emitter` e `EventTarget` não compõem com operadores
(filtrar, transformar, combinar, reagendar). Use `Subject`/`Observable`.

## RX07 — emissor-conhece-observador

O módulo que muda (leilões/lances) **não pode** importar quem reage (notificações). A dependência
é invertida: o observador assina o fluxo do emissor.

```ts
// ❌ leiloes/aplicacao/leiloes.service.ts
import { NotificacoesService } from '../../notificacoes/aplicacao/notificacoes.service.js';
this.notificacoes.adicionar(anterior.participante, ...);
// ✅ notificacoes/aplicacao/notificacoes.service.ts
constructor(leiloes: LeiloesService) { this.estado$ = leiloes.eventos$.pipe(scan(reduzir, INICIAL), ...); }
```

## RX08 — acumulador-mutado

O redutor do `scan` deve ser **puro**: devolve um novo valor em vez de alterar o acumulador
(senão projeções diferentes compartilham o mesmo objeto mutável).

```ts
// ❌
scan((acc, e) => { acc.push(e); return acc; }, [])
// ✅
scan((acc, e) => [...acc, e], [])
scan((acc, e) => new Map(acc).set(e.id, e), new Map())
```

## RX09 — dependencia-circular

Ciclos de import (A → B → A) tornam a ordem de inicialização frágil e escondem quem depende de
quem. Extraia o compartilhado (normalmente tipos) para `dominio/tipos.ts`. Imports `import type`
não contam.
