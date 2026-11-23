import { randomUUID } from 'node:crypto';
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  EMPTY,
  type Observable,
  Subject,
  concatMap,
  defer,
  filter,
  first,
  from,
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
import {
  ESTADO_INICIAL,
  PROCESSAMENTO_INICIAL,
  processar,
} from '../dominio/regras.js';
import type {
  Comando,
  Entrada,
  Estado,
  EventoLeilao,
  LeilaoCriado,
  LeilaoProrrogado,
  Processamento,
  Resultado,
} from '../dominio/tipos.js';

const ehPrazo = (e: EventoLeilao): e is LeilaoCriado | LeilaoProrrogado =>
  e.tipo === 'LeilaoCriado' || e.tipo === 'LeilaoProrrogado';

/**
 * Núcleo reativo dos leilões.
 *
 *  comandos (Sink) ──scan(processar)──► processamento$ ──► eventos$ (log, com replay)
 *                                                     └──► estado$ (projeção atual)
 *  eventos$ ──groupBy(leilão)──switchMap(timer(encerraEm))──► comando EncerrarLeilao (realimenta o Sink)
 */
@Injectable()
export class LeiloesService implements OnModuleInit, OnModuleDestroy {
  /** Sink: única porta de entrada de mudanças. Privado (nunca exposto). */
  private readonly entrada$ = new Subject<Entrada>();
  private readonly destruir$ = new Subject<void>();

  /** Processa um comando por vez, na ordem de chegada (scan é sequencial). */
  private readonly processamento$: Observable<Processamento> = this.entrada$.pipe(
    scan(
      (anterior: Processamento, entrada: Entrada) =>
        processar(anterior.estado, entrada),
      PROCESSAMENTO_INICIAL,
    ),
    share({ resetOnRefCountZero: false }),
  );

  /** Log de eventos de todos os leilões; novos assinantes recebem o histórico completo. */
  readonly eventos$: Observable<EventoLeilao> = this.processamento$.pipe(
    concatMap((p) => from(p.eventos)),
    shareReplay({ bufferSize: Infinity, refCount: false }),
  );

  /** Estado atual (projeção do log). */
  readonly estado$: Observable<Estado> = this.processamento$.pipe(
    map((p) => p.estado),
    startWith(ESTADO_INICIAL),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /** Comandos de encerramento gerados pelo tempo (reagendados a cada prorrogação). */
  private readonly encerramentos$: Observable<Comando> = this.eventos$.pipe(
    groupBy((e) => e.leilaoId),
    mergeMap((eventosDoLeilao$) =>
      eventosDoLeilao$.pipe(
        takeWhile((e) => e.tipo !== 'LeilaoEncerrado'),
        filter(ehPrazo),
        switchMap((e) =>
          timer(new Date(e.dados.encerraEm)).pipe(
            map((): Comando => ({
              tipo: 'EncerrarLeilao',
              leilaoId: eventosDoLeilao$.key,
              prazo: e.dados.encerraEm,
            })),
          ),
        ),
      ),
    ),
  );

  onModuleInit(): void {
    // Conecta as projeções desde o início e liga a realimentação do temporizador.
    merge(this.eventos$, this.estado$)
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

  /** Envia um comando ao Sink e devolve (uma vez) o resultado do seu processamento. */
  executar(comando: Comando): Observable<Resultado> {
    return defer(() => {
      const entrada: Entrada = {
        id: randomUUID(),
        comando,
        instante: Date.now(),
      };
      const resultado$ = this.processamento$.pipe(
        first((p) => p.entradaId === entrada.id),
        map((p) => p.resultado),
      );
      const envio$ = defer(() => {
        this.entrada$.next(entrada);
        return EMPTY;
      });
      // merge assina resultado$ antes de enviar: a resposta não se perde.
      return merge(resultado$, envio$).pipe(take(1));
    });
  }

  /** Eventos de um leilão: histórico + novos; completa após LeilaoEncerrado. */
  eventosDoLeilao(leilaoId: string): Observable<EventoLeilao> {
    return this.eventos$.pipe(
      filter((e) => e.leilaoId === leilaoId),
      takeWhile((e) => e.tipo !== 'LeilaoEncerrado', true),
    );
  }

  /** Fotografia do estado atual. */
  estadoAtual(): Observable<Estado> {
    return this.estado$.pipe(take(1));
  }
}
