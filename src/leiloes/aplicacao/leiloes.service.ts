import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  EMPTY, type Observable, Subject, concatMap, defer, filter, first, from, groupBy, map, merge,
  mergeMap, scan, share, shareReplay, startWith, switchMap, take, takeUntil, takeWhile, timer,
} from 'rxjs';
import { ESTADO_INICIAL, PROCESSAMENTO_INICIAL, processar } from '../dominio/regras.js';
import type { Comando, Entrada, Estado, Evento, Processamento, Resultado } from '../dominio/tipos.js';

@Injectable()
export class LeiloesService implements OnModuleInit, OnModuleDestroy {
  private readonly entrada$ = new Subject<Entrada>();
  private readonly destruir$ = new Subject<void>();

  private readonly processamento$: Observable<Processamento> = this.entrada$.pipe(
    scan((ant: Processamento, e: Entrada) => processar(ant.estado, e), PROCESSAMENTO_INICIAL),
    share({ resetOnRefCountZero: false }),
  );

  readonly eventos$: Observable<Evento> = this.processamento$.pipe(
    concatMap((p) => from(p.eventos)),
    shareReplay({ bufferSize: Infinity, refCount: false }),
  );

  readonly estado$: Observable<Estado> = this.processamento$.pipe(
    map((p) => p.estado),
    startWith(ESTADO_INICIAL),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  private readonly encerramentos$: Observable<Comando> = this.eventos$.pipe(
    groupBy((e) => e.leilaoId),
    mergeMap((grupo$) =>
      grupo$.pipe(
        takeWhile((e) => e.tipo !== 'LeilaoEncerrado'),
        filter((e) => e.tipo === 'LeilaoCriado' || e.tipo === 'LeilaoProrrogado'),
        switchMap((e) => {
          const prazo = e.dados['encerraEm'] as string;
          return timer(new Date(prazo)).pipe(
            map((): Comando => ({ tipo: 'Encerrar', leilaoId: grupo$.key, prazo })),
          );
        }),
      ),
    ),
  );

  onModuleInit(): void {
    merge(this.eventos$, this.estado$).pipe(takeUntil(this.destruir$)).subscribe();
    this.encerramentos$
      .pipe(concatMap((c) => this.executar(c)), takeUntil(this.destruir$))
      .subscribe();
  }

  onModuleDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  executar(comando: Comando): Observable<Resultado> {
    return defer(() => {
      const entrada: Entrada = { id: randomUUID(), comando, instante: Date.now() };
      const resultado$ = this.processamento$.pipe(
        first((p) => p.entradaId === entrada.id),
        map((p) => p.resultado),
      );
      const envio$ = defer(() => {
        this.entrada$.next(entrada);
        return EMPTY;
      });
      return merge(resultado$, envio$).pipe(take(1));
    });
  }

  eventosDoLeilao(id: string): Observable<Evento> {
    return this.eventos$.pipe(
      filter((e) => e.leilaoId === id),
      takeWhile((e) => e.tipo !== 'LeilaoEncerrado', true),
    );
  }

  estadoAtual(): Observable<Estado> {
    return this.estado$.pipe(take(1));
  }
}
