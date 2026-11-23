import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { type Observable, Subject, map, scan, shareReplay, startWith, take, takeUntil } from 'rxjs';
import { LeiloesService } from '../../leiloes/aplicacao/leiloes.service.js';
import { ESTADO_INICIAL, notificacoesDe, reduzir } from '../dominio/regras.js';
import type { EstadoNotificacoes, Notificacao } from '../dominio/tipos.js';

@Injectable()
export class NotificacoesService implements OnModuleInit, OnModuleDestroy {
  private readonly destruir$ = new Subject<void>();
  private readonly estado$: Observable<EstadoNotificacoes>;

  constructor(leiloes: LeiloesService) {
    this.estado$ = leiloes.eventos$.pipe(
      scan(reduzir, ESTADO_INICIAL),
      startWith(ESTADO_INICIAL),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  onModuleInit(): void {
    this.estado$.pipe(takeUntil(this.destruir$)).subscribe();
  }

  onModuleDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  doParticipante(nome: string): Observable<readonly Notificacao[]> {
    return this.estado$.pipe(
      take(1),
      map((e) => notificacoesDe(e, nome)),
    );
  }
}
