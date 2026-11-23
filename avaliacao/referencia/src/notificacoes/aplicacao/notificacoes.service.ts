import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  type Observable,
  Subject,
  map,
  scan,
  shareReplay,
  startWith,
  take,
  takeUntil,
} from 'rxjs';
import { LeiloesService } from '../../leiloes/aplicacao/leiloes.service.js';
import {
  NOTIFICACOES_INICIAL,
  type EstadoNotificacoes,
  type Notificacao,
  acumularNotificacoes,
} from '../dominio/notificacoes.js';

/**
 * Observador independente do log de eventos dos leilões.
 * O módulo de leilões não sabe que este serviço existe (padrão Observer).
 */
@Injectable()
export class NotificacoesService implements OnModuleInit, OnModuleDestroy {
  private readonly destruir$ = new Subject<void>();
  private readonly estado$: Observable<EstadoNotificacoes>;

  constructor(leiloes: LeiloesService) {
    this.estado$ = leiloes.eventos$.pipe(
      scan(acumularNotificacoes, NOTIFICACOES_INICIAL),
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
    return this.estado$.pipe(
      take(1),
      map((estado) => estado.porParticipante.get(nome) ?? []),
    );
  }
}
