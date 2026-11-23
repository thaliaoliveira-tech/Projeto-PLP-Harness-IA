import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EMPTY,
  Observable,
  Subject,
  defer,
  filter,
  groupBy,
  ignoreElements,
  map,
  merge,
  mergeMap,
  of,
  scan,
  share,
  shareReplay,
  startWith,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  tap,
  timer,
} from 'rxjs';
import type {
  EventoLeilao,
  Leilao,
  ResultadoLance,
  TipoEvento,
} from './leilao.types.js';

export interface DadosCriacao {
  titulo: string;
  lanceInicial: number;
  incrementoMinimo: number;
  duracaoSegundos: number;
  prorrogacaoSegundos: number;
}

/** Leilão + seu histórico de eventos (a fonte de verdade é o histórico). */
interface LeilaoEstado {
  readonly leilao: Leilao;
  readonly eventos: readonly EventoLeilao[];
}
interface Estado {
  readonly leiloes: ReadonlyMap<string, LeilaoEstado>;
}

type Comando = { correlacao: string; agora: number } & (
  | { tipo: 'criar'; id: string; dados: DadosCriacao }
  | { tipo: 'lance'; id: string; corpo: unknown }
  | { tipo: 'encerrar'; id: string; prazo: string }
);

type Resultado =
  ResultadoLance | { status: 'CRIADO'; leilao: Leilao } | { status: 'NENHUM' };

interface Transicao {
  readonly estado: Estado;
  readonly eventos: readonly EventoLeilao[];
  readonly correlacao: string;
  readonly resultado: Resultado;
}

const inicial: Transicao = {
  estado: { leiloes: new Map() },
  eventos: [],
  correlacao: '',
  resultado: { status: 'NENHUM' },
};

type Rascunho = [TipoEvento, string, Record<string, unknown>];

/** Acrescenta eventos (numerando a sequência) e aplica um patch ao leilão. */
function anexar(
  e: LeilaoEstado,
  patch: Partial<Leilao>,
  rascunhos: Rascunho[],
): { e: LeilaoEstado; novos: EventoLeilao[] } {
  const novos = rascunhos.map(([tipo, ocorridoEm, dados], i): EventoLeilao => ({
    sequencia: e.eventos.length + i + 1,
    tipo,
    leilaoId: e.leilao.id,
    ocorridoEm,
    dados,
  }));
  return {
    e: { leilao: { ...e.leilao, ...patch }, eventos: [...e.eventos, ...novos] },
    novos,
  };
}

function encerrar(e: LeilaoEstado) {
  const l = e.leilao;
  const vencedor = l.maiorLance?.participante ?? null;
  return anexar(e, { status: 'ENCERRADO', vencedor }, [
    [
      'LeilaoEncerrado',
      l.encerraEm,
      { vencedor, valor: l.maiorLance?.valor ?? null },
    ],
  ]);
}

function comLeilao(
  prev: Transicao,
  c: Comando,
  e: LeilaoEstado,
  novos: EventoLeilao[],
  resultado: Resultado,
): Transicao {
  return {
    estado: { leiloes: new Map(prev.estado.leiloes).set(e.leilao.id, e) },
    eventos: novos,
    correlacao: c.correlacao,
    resultado,
  };
}

/** Função pura: (estado, comando) -> transição. */
function reduzir(prev: Transicao, c: Comando): Transicao {
  const semMudanca = (resultado: Resultado): Transicao => ({
    estado: prev.estado,
    eventos: [],
    correlacao: c.correlacao,
    resultado,
  });

  if (c.tipo === 'criar') {
    const d = c.dados;
    const encerraEm = new Date(
      c.agora + d.duracaoSegundos * 1000,
    ).toISOString();
    const leilao: Leilao = {
      id: c.id,
      titulo: d.titulo,
      lanceInicial: d.lanceInicial,
      incrementoMinimo: d.incrementoMinimo,
      prorrogacaoSegundos: d.prorrogacaoSegundos,
      status: 'ABERTO',
      maiorLance: null,
      totalLances: 0,
      encerraEm,
      vencedor: null,
    };
    const { e, novos } = anexar({ leilao, eventos: [] }, {}, [
      [
        'LeilaoCriado',
        new Date(c.agora).toISOString(),
        {
          titulo: d.titulo,
          lanceInicial: d.lanceInicial,
          incrementoMinimo: d.incrementoMinimo,
          prorrogacaoSegundos: d.prorrogacaoSegundos,
          encerraEm,
        },
      ],
    ]);
    return comLeilao(prev, c, e, novos, { status: 'CRIADO', leilao: e.leilao });
  }

  const atual = prev.estado.leiloes.get(c.id);
  if (!atual) return semMudanca({ status: 404 });

  if (c.tipo === 'encerrar') {
    // Ignora timers obsoletos (leilão já encerrado ou prorrogado).
    if (
      atual.leilao.status !== 'ABERTO' ||
      atual.leilao.encerraEm !== c.prazo
    ) {
      return semMudanca({ status: 'NENHUM' });
    }
    const { e, novos } = encerrar(atual);
    return comLeilao(prev, c, e, novos, { status: 'NENHUM' });
  }

  // c.tipo === 'lance'
  const b = c.corpo as Record<string, unknown> | null | undefined;
  const participante = b?.participante;
  const valor = b?.valor;
  if (
    typeof participante !== 'string' ||
    participante === '' ||
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    valor <= 0
  ) {
    return semMudanca({ status: 400 });
  }

  const ocorridoEm = new Date(c.agora).toISOString();
  const prazoMs = Date.parse(atual.leilao.encerraEm);
  if (atual.leilao.status === 'ENCERRADO' || c.agora >= prazoMs) {
    const fechado =
      atual.leilao.status === 'ABERTO'
        ? encerrar(atual)
        : { e: atual, novos: [] };
    return comLeilao(prev, c, fechado.e, fechado.novos, {
      status: 409,
      corpo: { aceito: false, motivo: 'LEILAO_ENCERRADO' },
    });
  }

  const l = atual.leilao;
  const rejeitar = (motivo: string, extra: Record<string, unknown> = {}) => {
    const { e, novos } = anexar(atual, {}, [
      ['LanceRejeitado', ocorridoEm, { participante, valor, motivo }],
    ]);
    return comLeilao(prev, c, e, novos, {
      status: 422,
      corpo: { aceito: false, motivo, ...extra },
    });
  };

  if (l.maiorLance?.participante === participante) {
    return rejeitar('PARTICIPANTE_JA_LIDERA');
  }
  const valorMinimo = l.maiorLance
    ? l.maiorLance.valor + l.incrementoMinimo
    : l.lanceInicial;
  if (valor < valorMinimo) {
    return rejeitar('VALOR_ABAIXO_DO_MINIMO', { valorMinimo });
  }

  const prorrogar =
    l.prorrogacaoSegundos > 0 &&
    prazoMs - c.agora < l.prorrogacaoSegundos * 1000;
  const novoPrazo = new Date(
    c.agora + l.prorrogacaoSegundos * 1000,
  ).toISOString();
  const patch: Partial<Leilao> = {
    maiorLance: { participante, valor, ocorridoEm },
    totalLances: l.totalLances + 1,
    ...(prorrogar ? { encerraEm: novoPrazo } : {}),
  };
  const rascunhos: Rascunho[] = [
    ['LanceAceito', ocorridoEm, { participante, valor }],
    ...(prorrogar
      ? [
          [
            'LeilaoProrrogado',
            ocorridoEm,
            { encerraEmAnterior: l.encerraEm, encerraEm: novoPrazo },
          ] as Rascunho,
        ]
      : []),
  ];
  const { e, novos } = anexar(atual, patch, rascunhos);
  return comLeilao(prev, c, e, novos, {
    status: 201,
    corpo: { aceito: true, leilao: e.leilao },
  });
}

@Injectable()
export class LeilaoService implements OnModuleInit, OnModuleDestroy {
  /** Entrada de comandos; só este serviço chama next(). */
  private readonly comando$ = new Subject<Comando>();
  private readonly destruir$ = new Subject<void>();

  /** Cada comando produz uma transição, processada em ordem de chegada. */
  private readonly transicao$ = this.comando$.pipe(
    scan(reduzir, inicial),
    share(),
  );

  private readonly estado$ = this.transicao$.pipe(
    map((t) => t.estado),
    startWith(inicial.estado),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Fluxo de todos os eventos de todos os leilões (para observadores). */
  readonly eventos$: Observable<EventoLeilao> = this.transicao$.pipe(
    mergeMap((t) => t.eventos),
    share(),
  );

  onModuleInit() {
    // Mantém o estado conectado desde o início.
    this.estado$.pipe(takeUntil(this.destruir$)).subscribe();

    // Efeito: agenda o encerramento a cada novo prazo (criação/prorrogação).
    this.eventos$
      .pipe(
        filter((ev) =>
          ['LeilaoCriado', 'LeilaoProrrogado', 'LeilaoEncerrado'].includes(
            ev.tipo,
          ),
        ),
        groupBy((ev) => ev.leilaoId),
        mergeMap((porLeilao) =>
          porLeilao.pipe(
            takeWhile((ev) => ev.tipo !== 'LeilaoEncerrado', true),
            switchMap((ev) => {
              if (ev.tipo === 'LeilaoEncerrado') return EMPTY;
              const prazo = ev.dados.encerraEm as string;
              return timer(Math.max(0, Date.parse(prazo) - Date.now())).pipe(
                map((): Comando => ({
                  tipo: 'encerrar',
                  correlacao: randomUUID(),
                  id: ev.leilaoId,
                  prazo,
                  // O timer pode disparar 1 ms antes; o prazo é o instante lógico.
                  agora: Math.max(Date.now(), Date.parse(prazo)),
                })),
              );
            }),
          ),
        ),
        takeUntil(this.destruir$),
      )
      .subscribe((cmd) => this.comando$.next(cmd));
  }

  onModuleDestroy() {
    this.destruir$.next();
    this.destruir$.complete();
  }

  /** Envia o comando e devolve a resposta da transição correspondente. */
  private despachar(
    montar: (base: { correlacao: string; agora: number }) => Comando,
  ) {
    return defer(() => {
      const cmd = montar({ correlacao: randomUUID(), agora: Date.now() });
      return merge(
        this.transicao$.pipe(
          filter((t) => t.correlacao === cmd.correlacao),
          take(1),
          map((t) => t.resultado),
        ),
        of(cmd).pipe(
          tap((c) => this.comando$.next(c)),
          ignoreElements(),
        ),
      );
    });
  }

  // ---------- consultas ----------

  private leilaoEstado(id: string) {
    return this.estado$.pipe(
      take(1),
      map((s) => s.leiloes.get(id)),
    );
  }

  listar(): Observable<Leilao[]> {
    return this.estado$.pipe(
      take(1),
      map((s) => [...s.leiloes.values()].map((e) => e.leilao)),
    );
  }

  obter(id: string): Observable<Leilao> {
    return this.leilaoEstado(id).pipe(map((e) => this.existente(e).leilao));
  }

  eventos(id: string): Observable<readonly EventoLeilao[]> {
    return this.leilaoEstado(id).pipe(map((e) => this.existente(e).eventos));
  }

  /** Histórico seguido dos eventos novos; completa após LeilaoEncerrado. */
  stream(id: string): Observable<EventoLeilao> {
    return this.estado$.pipe(
      map((s) => this.existente(s.leiloes.get(id)).eventos),
      scan(
        (acc, eventos) => ({
          vistos: eventos.length,
          novos: eventos.slice(acc.vistos),
        }),
        { vistos: 0, novos: [] as readonly EventoLeilao[] },
      ),
      mergeMap((acc) => acc.novos),
      takeWhile((ev) => ev.tipo !== 'LeilaoEncerrado', true),
    );
  }

  private existente(e: LeilaoEstado | undefined): LeilaoEstado {
    if (!e) throw new NotFoundException();
    return e;
  }

  // ---------- comandos ----------

  criar(dados: DadosCriacao): Observable<Leilao> {
    return this.despachar((base) => ({
      ...base,
      tipo: 'criar',
      id: randomUUID(),
      dados,
    })).pipe(map((r) => (r as { status: 'CRIADO'; leilao: Leilao }).leilao));
  }

  darLance(id: string, corpo: unknown): Observable<ResultadoLance> {
    return this.despachar((base) => ({
      ...base,
      tipo: 'lance',
      id,
      corpo,
    })).pipe(map((r) => r as ResultadoLance));
  }
}
