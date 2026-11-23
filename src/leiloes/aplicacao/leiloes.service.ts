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
  paraLeilao,
  processar,
  registrar,
} from '../dominio/regras.js';
import type {
  ComandoLeilao,
  CriarLeilao,
  EventoLeilao,
  Leilao,
  Processamento,
} from '../dominio/tipos.js';

interface Entrada {
  id: string;
  comando: ComandoLeilao;
  instante: number;
}

export interface ProcessamentoDeEntrada extends Processamento {
  entradaId: string;
}

const PROCESSAMENTO_INICIAL: ProcessamentoDeEntrada = {
  entradaId: '',
  estado: ESTADO_INICIAL,
  eventos: [],
  resposta: { tipo: 'OK' },
};

@Injectable()
export class LeiloesService implements OnModuleInit, OnModuleDestroy {
  /** Sink: único ponto de entrada de comandos; só este serviço chama next(). */
  private readonly entrada$ = new Subject<Entrada>();
  private readonly destruir$ = new Subject<void>();

  /** scan serializa os comandos: um por vez, na ordem de chegada. */
  private readonly processamento$ = this.entrada$.pipe(
    scan(
      (anterior, entrada): ProcessamentoDeEntrada => ({
        entradaId: entrada.id,
        ...processar(anterior.estado, entrada.comando, entrada.instante),
      }),
      PROCESSAMENTO_INICIAL,
    ),
    share({ resetOnRefCountZero: false }),
  );

  /** Log de eventos (fonte da verdade); quem assina depois recebe todo o histórico. */
  readonly eventos$: Observable<EventoLeilao> = this.processamento$.pipe(
    concatMap((p) => p.eventos),
    shareReplay({ bufferSize: Infinity, refCount: false }),
  );

  private readonly estado$ = this.processamento$.pipe(
    map((p) => p.estado),
    startWith(ESTADO_INICIAL),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  private readonly historico$ = this.eventos$.pipe(
    scan(registrar, {} as Readonly<Record<string, readonly EventoLeilao[]>>),
    startWith({} as Readonly<Record<string, readonly EventoLeilao[]>>),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /** Para cada leilão, o prazo mais recente agenda o encerramento; switchMap cancela o anterior. */
  private readonly encerramentos$: Observable<ComandoLeilao> =
    this.eventos$.pipe(
      groupBy((e) => e.leilaoId),
      mergeMap((grupo$) =>
        grupo$.pipe(
          takeWhile((e) => e.tipo !== 'LeilaoEncerrado'),
          filter(
            (e) => e.tipo === 'LeilaoCriado' || e.tipo === 'LeilaoProrrogado',
          ),
          switchMap((e) =>
            timer(new Date(e.dados.encerraEm)).pipe(
              map((): ComandoLeilao => ({
                tipo: 'EncerrarLeilao',
                leilaoId: e.leilaoId,
                prazo: e.dados.encerraEm,
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

  /** Envia o comando e devolve o resultado do *seu* processamento (assina antes de enviar). */
  executar(comando: ComandoLeilao): Observable<ProcessamentoDeEntrada> {
    return defer(() => {
      const entrada: Entrada = {
        id: randomUUID(),
        comando,
        instante: Date.now(),
      };
      const resultado$ = this.processamento$.pipe(
        first((p) => p.entradaId === entrada.id),
      );
      const envio$ = defer(() => {
        this.entrada$.next(entrada);
        return EMPTY;
      });
      return merge(resultado$, envio$).pipe(take(1));
    });
  }

  criar(dados: Omit<CriarLeilao, 'tipo' | 'id'>): Observable<Leilao> {
    return this.executar({
      tipo: 'CriarLeilao',
      id: randomUUID(),
      ...dados,
    }).pipe(
      map((p) => {
        if (p.resposta.tipo !== 'CRIADO')
          throw new Error('criação de leilão não gerou evento');
        return paraLeilao(p.estado.leiloes[p.resposta.leilaoId]!);
      }),
    );
  }

  listar(): Observable<Leilao[]> {
    return this.estado$.pipe(
      take(1),
      map((e) => Object.values(e.leiloes).map(paraLeilao)),
    );
  }

  obter(id: string): Observable<Leilao | undefined> {
    return this.estado$.pipe(
      take(1),
      map((e) => (e.leiloes[id] ? paraLeilao(e.leiloes[id]) : undefined)),
    );
  }

  historico(id: string): Observable<readonly EventoLeilao[] | undefined> {
    return this.historico$.pipe(
      take(1),
      map((h) => h[id]),
    );
  }

  darLance(
    leilaoId: string,
    participante: string,
    valor: number,
  ): Observable<ProcessamentoDeEntrada> {
    return this.executar({ tipo: 'DarLance', leilaoId, participante, valor });
  }

  /** Eventos de um leilão (histórico + novos); completa após LeilaoEncerrado. */
  stream(id: string): Observable<EventoLeilao> {
    return this.eventos$.pipe(
      filter((e) => e.leilaoId === id),
      takeWhile((e) => e.tipo !== 'LeilaoEncerrado', true),
    );
  }
}
