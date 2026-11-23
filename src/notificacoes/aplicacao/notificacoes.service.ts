import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  map,
  type Observable,
  scan,
  shareReplay,
  startWith,
  Subject,
  take,
  takeUntil,
} from 'rxjs';
import { LeiloesService } from '../../leiloes/aplicacao/leiloes.service.js';
import { NOTIFICACOES_INICIAL, reduzir } from '../dominio/notificacoes.js';
import type { EstadoNotificacoes, Notificacao } from '../dominio/tipos.js';

/** Observador: projeta o log de eventos de leilões em notificações. */
@Injectable()
export class NotificacoesService implements OnModuleInit, OnModuleDestroy {
  private readonly destruir$ = new Subject<void>();
  readonly estado$: Observable<EstadoNotificacoes>;

  constructor(leiloes: LeiloesService) {
    this.estado$ = leiloes.eventos$.pipe(
      scan(reduzir, NOTIFICACOES_INICIAL),
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

  deParticipante(nome: string): Observable<readonly Notificacao[]> {
    return this.estado$.pipe(
      take(1),
      map((e) => e.porParticipante.get(nome) ?? []),
    );
  }
}
