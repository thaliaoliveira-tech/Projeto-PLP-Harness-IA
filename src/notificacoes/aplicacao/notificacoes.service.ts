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
  notificacoesDe,
  reduzir,
} from '../dominio/regras.js';
import type { Notificacao } from '../dominio/tipos.js';

/** Observador: projeta o log de eventos de leilões em notificações por participante. */
@Injectable()
export class NotificacoesService implements OnModuleInit, OnModuleDestroy {
  private readonly destruir$ = new Subject<void>();
  private readonly estado$;

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

  doParticipante(nome: string): Observable<readonly Notificacao[]> {
    return this.estado$.pipe(
      take(1),
      map((e) => notificacoesDe(e, nome)),
    );
  }
}
