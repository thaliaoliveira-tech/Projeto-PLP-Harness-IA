import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  Observable,
  Subject,
  map,
  scan,
  shareReplay,
  startWith,
  take,
  takeUntil,
} from 'rxjs';
import { LeilaoService } from './leilao.service.js';
import type { EventoLeilao, Notificacao } from './leilao.types.js';

interface Estado {
  readonly leiloes: ReadonlyMap<
    string,
    { titulo: string; lider: { participante: string; valor: number } | null }
  >;
  readonly notificacoes: ReadonlyMap<string, readonly Notificacao[]>;
}

const inicial: Estado = { leiloes: new Map(), notificacoes: new Map() };

const adicionar = (
  mapa: Estado['notificacoes'],
  nome: string,
  n: Notificacao,
) => new Map(mapa).set(nome, [...(mapa.get(nome) ?? []), n]);

/** Função pura: aplica um evento de leilão ao estado de notificações. */
function evoluir(estado: Estado, ev: EventoLeilao): Estado {
  const info = estado.leiloes.get(ev.leilaoId);
  switch (ev.tipo) {
    case 'LeilaoCriado':
      return {
        ...estado,
        leiloes: new Map(estado.leiloes).set(ev.leilaoId, {
          titulo: ev.dados.titulo as string,
          lider: null,
        }),
      };
    case 'LanceAceito': {
      if (!info) return estado;
      const participante = ev.dados.participante as string;
      const valor = ev.dados.valor as number;
      const anterior = info.lider;
      const notificacoes =
        anterior && anterior.participante !== participante
          ? adicionar(estado.notificacoes, anterior.participante, {
              tipo: 'LANCE_SUPERADO',
              leilaoId: ev.leilaoId,
              titulo: info.titulo,
              valorAnterior: anterior.valor,
              novoValor: valor,
              ocorridoEm: ev.ocorridoEm,
            })
          : estado.notificacoes;
      return {
        leiloes: new Map(estado.leiloes).set(ev.leilaoId, {
          ...info,
          lider: { participante, valor },
        }),
        notificacoes,
      };
    }
    case 'LeilaoEncerrado':
      if (!info || ev.dados.vencedor === null) return estado;
      return {
        ...estado,
        notificacoes: adicionar(
          estado.notificacoes,
          ev.dados.vencedor as string,
          {
            tipo: 'LEILAO_VENCIDO',
            leilaoId: ev.leilaoId,
            titulo: info.titulo,
            valor: ev.dados.valor as number,
            ocorridoEm: ev.ocorridoEm,
          },
        ),
      };
    default:
      return estado;
  }
}

/** Observador: assina os eventos de leilões e projeta as notificações. */
@Injectable()
export class NotificacoesService implements OnModuleInit, OnModuleDestroy {
  private readonly destruir$ = new Subject<void>();
  private readonly estado$: Observable<Estado>;

  constructor(leiloes: LeilaoService) {
    this.estado$ = leiloes.eventos$.pipe(
      scan(evoluir, inicial),
      startWith(inicial),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  onModuleInit() {
    this.estado$.pipe(takeUntil(this.destruir$)).subscribe();
  }

  onModuleDestroy() {
    this.destruir$.next();
    this.destruir$.complete();
  }

  listar(nome: string): Observable<readonly Notificacao[]> {
    return this.estado$.pipe(
      take(1),
      map((s) => s.notificacoes.get(nome) ?? []),
    );
  }
}
