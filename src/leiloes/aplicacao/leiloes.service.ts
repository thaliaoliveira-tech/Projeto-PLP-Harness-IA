import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  EMPTY,
  type Observable,
  Subject,
  concatMap,
  defer,
  filter,
  first,
  groupBy,
  map,
  merge,
  mergeMap,
  scan,
  share,
  shareReplay,
  startWith,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  timer,
} from 'rxjs';
import { decidir, evoluir, paraLeilao } from '../dominio/regras.js';
import type { Comando, EstadoLeilao, Evento, Leilao, Resultado } from '../dominio/tipos.js';

type Leiloes = ReadonlyMap<string, EstadoLeilao>;
type HistoricoPorLeilao = ReadonlyMap<string, readonly Evento[]>;

interface Entrada {
  id: string;
  comando: Comando;
  instante: number;
}

interface Processamento {
  entradaId: string;
  leiloes: Leiloes;
  eventos: readonly Evento[];
  resultado: Resultado | null;
}

const INICIAL: Processamento = { entradaId: '', leiloes: new Map(), eventos: [], resultado: null };

function processar(anterior: Processamento, { id, comando, instante }: Entrada): Processamento {
  const { eventos, resultado } = decidir(anterior.leiloes.get(comando.leilaoId), comando, instante);
  const leiloes = eventos.reduce<Leiloes>(
    (mapa, e) => new Map(mapa).set(e.leilaoId, evoluir(mapa.get(e.leilaoId), e)),
    anterior.leiloes,
  );
  return { entradaId: id, leiloes, eventos, resultado };
}

@Injectable()
export class LeiloesService implements OnModuleInit, OnModuleDestroy {
  /** Sink: único ponto de entrada de comandos; só este serviço chama next(). */
  private readonly entrada$ = new Subject<Entrada>();
  private readonly destruir$ = new Subject<void>();

  // scan serializa os comandos: um por vez, na ordem de chegada.
  private readonly processamento$ = this.entrada$.pipe(scan(processar, INICIAL), share({ resetOnRefCountZero: false }));

  /** Log de eventos (fonte da verdade); quem assina depois recebe todo o histórico. */
  readonly eventos$: Observable<Evento> = this.processamento$.pipe(
    concatMap((p) => p.eventos),
    shareReplay({ bufferSize: Infinity, refCount: false }),
  );

  /** Projeção: leilões atuais, na ordem de criação. */
  private readonly leiloes$: Observable<Leiloes> = this.processamento$.pipe(
    map((p) => p.leiloes),
    startWith(INICIAL.leiloes),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /** Projeção: histórico de eventos por leilão. */
  private readonly historico$: Observable<HistoricoPorLeilao> = this.eventos$.pipe(
    scan(
      (acc: HistoricoPorLeilao, e) => new Map(acc).set(e.leilaoId, [...(acc.get(e.leilaoId) ?? []), e]),
      new Map<string, readonly Evento[]>(),
    ),
    startWith(new Map<string, readonly Evento[]>() as HistoricoPorLeilao),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /** O tempo como fluxo: cada novo prazo cancela o temporizador anterior do mesmo leilão. */
  private readonly encerramentos$: Observable<Comando> = this.eventos$.pipe(
    groupBy((e) => e.leilaoId),
    mergeMap((grupo$) =>
      grupo$.pipe(
        takeWhile((e) => e.tipo !== 'LeilaoEncerrado'),
        filter((e) => e.tipo === 'LeilaoCriado' || e.tipo === 'LeilaoProrrogado'),
        switchMap((e) => {
          const prazo = e.dados.encerraEm;
          return timer(new Date(prazo)).pipe(
            map((): Comando => ({ tipo: 'EncerrarLeilao', leilaoId: grupo$.key, prazo })),
          );
        }),
      ),
    ),
  );

  onModuleInit(): void {
    // conecta as projeções desde o início
    merge(this.eventos$, this.leiloes$, this.historico$).pipe(takeUntil(this.destruir$)).subscribe();
    this.encerramentos$
      .pipe(
        concatMap((c) => this.executar(c)),
        takeUntil(this.destruir$),
      )
      .subscribe();
  }

  onModuleDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  /** Envia o comando ao Sink e devolve o resultado do *seu* processamento. */
  executar(comando: Comando): Observable<Resultado> {
    return defer(() => {
      const entrada: Entrada = { id: randomUUID(), comando, instante: Date.now() };
      const resultado$ = this.processamento$.pipe(
        first((p) => p.entradaId === entrada.id),
        map((p) => p.resultado as Resultado),
      );
      const envio$ = defer(() => {
        this.entrada$.next(entrada);
        return EMPTY;
      });
      return merge(resultado$, envio$).pipe(take(1));
    });
  }

  listar(): Observable<Leilao[]> {
    return this.leiloes$.pipe(
      take(1),
      map((m) => [...m.values()].map(paraLeilao)),
    );
  }

  /** Emite o leilão, ou completa sem valor se não existir. */
  obter(id: string): Observable<Leilao> {
    return this.leiloes$.pipe(
      take(1),
      filter((m) => m.has(id)),
      map((m) => paraLeilao(m.get(id) as EstadoLeilao)),
    );
  }

  /** Histórico do leilão; completa sem valor se não existir. */
  historico(id: string): Observable<readonly Evento[]> {
    return this.historico$.pipe(
      take(1),
      filter((h) => h.has(id)),
      map((h) => h.get(id) as readonly Evento[]),
    );
  }

  /** Eventos já ocorridos do leilão e depois os novos; completa após LeilaoEncerrado. */
  acompanhar(id: string): Observable<Evento> {
    return this.eventos$.pipe(
      filter((e) => e.leilaoId === id),
      takeWhile((e) => e.tipo !== 'LeilaoEncerrado', true),
    );
  }
}
