# AGENTS.md — instruções para agentes de IA

API NestJS de **leilões em tempo real** construída com **programação reativa / orientada a eventos (RxJS)**.
Leia este arquivo inteiro antes de alterar o código. Detalhes em [`docs/arquitetura.md`](docs/arquitetura.md) e [`docs/regras-reativas.md`](docs/regras-reativas.md).

## Regra de ouro

Uma tarefa só está concluída quando **`npm run validate` termina com `VALIDAÇÃO OK`**.

- Rode `npm run validate` antes de dizer que terminou e corrija **tudo** o que ele apontar.
- Nunca desative, apague ou afrouxe testes, regras de lint, o verificador, a configuração do dependency-cruiser ou os hooks para "fazer passar". Se achar que uma regra ou um teste está errado, **pare e explique ao usuário**.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run validate` | roda todas as verificações abaixo, em ordem, e imprime um resumo |
| `npm run build` / `npm run start:prod` | compila / sobe o servidor compilado (porta `PORT`, padrão 3000) |
| `npm test` | testes unitários (`src/**/*.spec.ts`) |
| `npm run test:e2e` | testes de contrato da API (`test/**/*.e2e-spec.ts`) |
| `npm run lint` | oxlint |
| `npm run regras` | verificador das regras reativas RX01–RX09 |
| `npm run dependencias` | regras de camadas (dependency-cruiser) |
| `npm run estrutura` | estrutura de pastas e testes do domínio |

## Ambiente

- NestJS 12 + TypeScript **ESM**: imports relativos terminam em **`.js`** (`import { X } from './x.js'`); `__dirname` não existe (use `import.meta.dirname`).
- Testes com **Vitest** (`vi.fn()`, não `jest.fn()`).
- Dados **só em memória**. Não adicione banco de dados nem bibliotecas de eventos além do RxJS.
- O exemplo `AppController`/`AppService` (e seus testes) pode ser removido.

## Arquitetura (resumo)

```
src/
├── main.ts / app.module.ts
├── leiloes/                     EMISSOR: comandos -> eventos
│   ├── leiloes.module.ts
│   ├── dominio/                 tipos + funções PURAS (decidir, evoluir). Sem NestJS, sem RxJS, sem Date.now()
│   ├── aplicacao/               serviço com os fluxos RxJS (Sink de comandos, log de eventos, projeções, temporizador)
│   └── http/                    controllers + validação de entrada; devolvem Observable
└── notificacoes/                OBSERVADOR: assina o log de eventos de leilões
    ├── notificacoes.module.ts
    ├── dominio/  aplicacao/  http/
```

Fluxo reativo esperado (ver diagrama em `docs/arquitetura.md`):

1. O **controller** valida a entrada e envia um **comando** ao **Sink** do serviço (um `Subject` **privado**).
2. O serviço processa **um comando por vez** com `scan`: *(estado, comando, instante) → eventos*, usando as funções puras do domínio.
3. Os **eventos** formam um **log** (`eventos$`, com replay): é a fonte da verdade.
4. Todo o resto é **projeção** do log: estado atual (`scan` + `shareReplay(1)`), histórico, notificações e o stream SSE.
5. O **tempo é um fluxo**: o encerramento é agendado com `switchMap(prazo => timer(prazo))`, reagendado a cada prorrogação, e realimenta o Sink com um comando de encerramento.
6. Quem muda **não conhece** quem reage: `leiloes/` nunca importa `notificacoes/`.

## Regras reativas (verificadas automaticamente)

| Regra | Nunca | Em vez disso |
|---|---|---|
| RX01 subscribe-aninhado | `a$.subscribe(() => b$.subscribe())` ou `subscribe` dentro de operador | `switchMap` / `mergeMap` / `concatMap` / `exhaustMap` |
| RX02 subscribe-fora-do-ciclo-de-vida | `subscribe` em controller ou em método chamado por requisição | controllers **devolvem** `Observable`; assinaturas permanentes só no `onModuleInit`, com `takeUntil(destruir$)` |
| RX03 subject-exposto | `Subject` público, exportado ou devolvido por método | `private readonly entrada$ = new Subject()` + `readonly x$ = ...asObservable()` |
| RX04 estado-mutavel | `this.mapa.set(...)`, `this.total++`, variável de módulo alterada | estado derivado: `eventos$.pipe(scan(evoluir, inicial), shareReplay(1))` |
| RX05 temporizador-imperativo | `setTimeout`, `setInterval`, `node:timers` | `timer`, `interval`, `delay`, `switchMap(() => timer(...))` |
| RX06 eventos-fora-do-rxjs | `EventEmitter`, `@nestjs/event-emitter`, `EventTarget` | `Subject`/`Observable` |
| RX07 emissor-conhece-observador | leilões importando notificações | notificações assinam `eventos$` de leilões |
| RX08 acumulador-mutado | `scan((acc, e) => { acc.push(e); return acc })` | `scan((acc, e) => [...acc, e])` |
| RX09 dependencia-circular | A importa B que importa A | extrair tipos compartilhados para `dominio/tipos.ts` |

Regras de camadas (`.dependency-cruiser.cjs`): `dominio-puro`, `aplicacao-nao-conhece-http`, `emissor-nao-conhece-observadores`, `observador-usa-api-publica`, `sem-ciclos`, `sem-event-emitter`.

## Testes

- Toda função de `dominio/` (exceto arquivos só de tipos) tem **teste unitário ao lado** (`regras.ts` → `regras.spec.ts`). Como o domínio recebe o instante por parâmetro, teste regras de tempo com instantes fixos.
- `test/contrato/` descreve o comportamento esperado da API (contrato). **Não altere esses testes** para fazê-los passar.
- Testes de contrato cobrem o essencial, **não tudo**: implemente a especificação inteira da tarefa, não apenas o que os testes verificam.

## Hooks do Claude Code (`.claude/settings.json`)

- Depois de cada edição de `.ts` em `src/`, o verificador de regras reativas roda e mostra violações daquele arquivo.
- Ao tentar encerrar, `npm run validate` roda; se falhar, você recebe os erros e deve continuar corrigindo (até 3 vezes por pedido do usuário).

## Antes de terminar

1. `npm run validate` → `VALIDAÇÃO OK`.
2. Responda com um resumo do que mudou e de como verificou.
