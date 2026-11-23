import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { type Observable, Subject, map, scan, shareReplay, startWith, take, takeUntil } from 'rxjs';
import { LeiloesService } from '../../leiloes/aplicacao/leiloes.service.js';
import { NOTIFICACOES_INICIAL, type EstadoNotificacoes, type Notificacao, acumular } from '../dominio/notificacoes.js';

@Injectable()
export class NotificacoesService implements OnModuleInit, OnModuleDestroy {
  private readonly destruir$ = new Subject<void>();
  private readonly estado$: Observable<EstadoNotificacoes>;

  constructor(leiloes: LeiloesService) {
    this.estado$ = leiloes.eventos$.pipe(
      scan(acumular, NOTIFICACOES_INICIAL),
      startWith(NOTIFICACOES_INICIAL),
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
    return this.estado$.pipe(take(1), map((e) => e.porParticipante.get(nome) ?? []));
  }
}
