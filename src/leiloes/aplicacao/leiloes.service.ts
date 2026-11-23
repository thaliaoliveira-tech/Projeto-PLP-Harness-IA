import { randomUUID } from 'node:crypto';
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  concatMap,
  defer,
  EMPTY,
  filter,
  first,
  groupBy,
  map,
  merge,
  mergeMap,
  type Observable,
  scan,
  share,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  timer,
} from 'rxjs';
import {
  decidir,
  ESTADO_INICIAL,
  evoluir,
  paraLeilao,
} from '../dominio/leilao.js';
import type {
  Comando,
  EstadoLeiloes,
  EventoLeilao,
  Leilao,
  Resultado,
} from '../dominio/tipos.js';

interface Entrada {
  id: string;
  comando: Comando;
  instante: number;
}

interface Processamento {
  entradaId: string;
  estado: EstadoLeiloes;
  eventos: EventoLeilao[];
  resultado: Resultado;
}

const PROCESSAMENTO_INICIAL: Processamento = {
  entradaId: '',
  estado: ESTADO_INICIAL,
  eventos: [],
  resultado: { tipo: 'IGNORADO' },
};

export interface RespostaComando {
  resultado: Resultado;
  /** Leilão afetado, já com o efeito do comando aplicado (quando existe). */
  leilao: Leilao | null;
}

@Injectable()
export class LeiloesService implements OnModuleInit, OnModuleDestroy {
  /** Sink: único ponto de entrada de comandos; só este serviço chama next(). */
  private readonly entrada$ = new Subject<Entrada>();
  private readonly destruir$ = new Subject<void>();

  /** Um comando por vez, na ordem de chegada. */
  private readonly processamento$ = this.entrada$.pipe(
    scan((anterior, entrada): Processamento => {
      const { eventos, resultado } = decidir(
        anterior.estado,
        entrada.comando,
        entrada.instante,
      );
      return {
        entradaId: entrada.id,
        estado: eventos.reduce(evoluir, anterior.estado),
        eventos,
        resultado,
      };
    }, PROCESSAMENTO_INICIAL),
    share({ resetOnRefCountZero: false }),
  );

  /** Log de eventos (fonte da verdade), com replay do histórico completo. */
  readonly eventos$: Observable<EventoLeilao> = this.processamento$.pipe(
    concatMap((p) => p.eventos),
    shareReplay({ bufferSize: Infinity, refCount: false }),
  );

  readonly estado$: Observable<EstadoLeiloes> = this.processamento$.pipe(
    map((p) => p.estado),
    startWith(ESTADO_INICIAL),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  private readonly historico$: Observable<
    ReadonlyMap<string, readonly EventoLeilao[]>
  > = this.eventos$.pipe(
    scan(
      (mapa, e) =>
        new Map(mapa).set(e.leilaoId, [...(mapa.get(e.leilaoId) ?? []), e]),
      new Map<string, readonly EventoLeilao[]>(),
    ),
    startWith(new Map<string, readonly EventoLeilao[]>()),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /** O tempo como fluxo: cada novo prazo (criação/prorrogação) cancela o temporizador anterior. */
  private readonly encerramentos$: Observable<Comando> = this.eventos$.pipe(
    groupBy((e) => e.leilaoId),
    mergeMap((grupo$) =>
      grupo$.pipe(
        takeWhile((e) => e.tipo !== 'LeilaoEncerrado'),
        filter(
          (e) => e.tipo === 'LeilaoCriado' || e.tipo === 'LeilaoProrrogado',
        ),
        map((e) => e.dados.encerraEm),
        switchMap((prazo) =>
          timer(new Date(prazo)).pipe(
            map((): Comando => ({
              tipo: 'EncerrarLeilao',
              leilaoId: grupo$.key,
              prazo,
            })),
          ),
        ),
      ),
    ),
  );

  onModuleInit(): void {
    merge(this.eventos$, this.estado$, this.historico$)
      .pipe(takeUntil(this.destruir$))
      .subscribe();
    this.encerramentos$
      .pipe(
        concatMap((comando) => this.executar(comando)),
        takeUntil(this.destruir$),
      )
      .subscribe();
  }

  onModuleDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  /** Envia o comando ao Sink e devolve o resultado do *seu* processamento. */
  executar(comando: Comando): Observable<RespostaComando> {
    return defer(() => {
      const entrada: Entrada = {
        id: randomUUID(),
        comando,
        instante: Date.now(),
      };
      const resposta$ = this.processamento$.pipe(
        first((p) => p.entradaId === entrada.id),
        map((p): RespostaComando => {
          const id = 'leilaoId' in comando ? comando.leilaoId : comando.id;
          const atual = p.estado.leiloes.get(id);
          return {
            resultado: p.resultado,
            leilao: atual ? paraLeilao(atual) : null,
          };
        }),
      );
      const envio$ = defer(() => {
        this.entrada$.next(entrada);
        return EMPTY;
      });
      return merge(resposta$, envio$).pipe(take(1));
    });
  }

  criar(
    dados: Extract<Comando, { tipo: 'CriarLeilao' }>['dados'],
  ): Observable<RespostaComando> {
    return this.executar({ tipo: 'CriarLeilao', id: randomUUID(), dados });
  }

  listar(): Observable<Leilao[]> {
    return this.estado$.pipe(
      take(1),
      map((e) => [...e.leiloes.values()].map(paraLeilao)),
    );
  }

  /** `null` quando o leilão não existe. */
  obter(id: string): Observable<Leilao | null> {
    return this.estado$.pipe(
      take(1),
      map((e) => {
        const l = e.leiloes.get(id);
        return l ? paraLeilao(l) : null;
      }),
    );
  }

  /** `null` quando o leilão não existe. */
  eventosDe(id: string): Observable<readonly EventoLeilao[] | null> {
    return this.historico$.pipe(
      take(1),
      map((h) => h.get(id) ?? null),
    );
  }

  /** Histórico + novos eventos do leilão; completa após `LeilaoEncerrado`. */
  acompanhar(id: string): Observable<EventoLeilao> {
    return this.eventos$.pipe(
      filter((e) => e.leilaoId === id),
      takeWhile((e) => e.tipo !== 'LeilaoEncerrado', true),
    );
  }
}
