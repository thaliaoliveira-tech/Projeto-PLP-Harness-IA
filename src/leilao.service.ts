import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EMPTY,
  Observable,
  Subject,
  concatMap,
  defer,
  distinctUntilChanged,
  filter,
  from,
  map,
  merge,
  scan,
  shareReplay,
  startWith,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  timer,
} from 'rxjs';
import type {
  Evento,
  Leilao,
  Notificacao,
  ResultadoLance,
  TipoEvento,
} from './leilao.types.js';

export interface NovoLeilao {
  titulo: string;
  lanceInicial: number;
  incrementoMinimo: number;
  duracaoSegundos: number;
  prorrogacaoSegundos: number;
}

type Comando =
  | { tipo: 'CRIAR'; cmdId: string; agora: number; id: string; dto: NovoLeilao }
  | { tipo: 'LANCE'; cmdId: string; agora: number; id: string; corpo: unknown }
  | { tipo: 'TICK'; agora: number };

interface Estado {
  readonly leiloes: ReadonlyMap<string, Leilao>; // ordem de inserção = ordem de criação
  readonly eventos: ReadonlyMap<string, readonly Evento[]>;
  readonly notificacoes: ReadonlyMap<string, readonly Notificacao[]>;
  readonly saida: { cmdId: string; resultado: unknown } | null;
}

const ESTADO_INICIAL: Estado = {
  leiloes: new Map(),
  eventos: new Map(),
  notificacoes: new Map(),
  saida: null,
};

function com<K, V>(m: ReadonlyMap<K, V>, k: K, v: V): ReadonlyMap<K, V> {
  const n = new Map(m);
  n.set(k, v);
  return n;
}

function anexar(
  s: Estado,
  id: string,
  tipo: TipoEvento,
  agora: number,
  dados: Record<string, unknown>,
): Estado {
  const lista = s.eventos.get(id) ?? [];
  const evento: Evento = {
    sequencia: lista.length + 1,
    tipo,
    leilaoId: id,
    ocorridoEm: new Date(agora).toISOString(),
    dados,
  };
  return { ...s, eventos: com(s.eventos, id, [...lista, evento]) };
}

function notificar(s: Estado, nome: string, n: Notificacao): Estado {
  return {
    ...s,
    notificacoes: com(s.notificacoes, nome, [
      ...(s.notificacoes.get(nome) ?? []),
      n,
    ]),
  };
}

function encerrar(s: Estado, id: string, agora: number): Estado {
  const l = s.leiloes.get(id);
  if (!l || l.status === 'ENCERRADO') return s;
  const vencedor = l.maiorLance?.participante ?? null;
  const fechado: Leilao = { ...l, status: 'ENCERRADO', vencedor };
  let n: Estado = { ...s, leiloes: com(s.leiloes, id, fechado) };
  n = anexar(n, id, 'LeilaoEncerrado', agora, {
    vencedor,
    valor: l.maiorLance?.valor ?? null,
  });
  if (l.maiorLance) {
    n = notificar(n, l.maiorLance.participante, {
      tipo: 'LEILAO_VENCIDO',
      leilaoId: id,
      titulo: l.titulo,
      valor: l.maiorLance.valor,
      ocorridoEm: new Date(agora).toISOString(),
    });
  }
  return n;
}

function encerrarVencidos(s: Estado, agora: number): Estado {
  let n = s;
  for (const l of s.leiloes.values()) {
    if (l.status === 'ABERTO' && Date.parse(l.encerraEm) <= agora) {
      n = encerrar(n, l.id, agora);
    }
  }
  return n;
}

function responder(s: Estado, cmdId: string, resultado: unknown): Estado {
  return { ...s, saida: { cmdId, resultado } };
}

function lance(
  s: Estado,
  c: Extract<Comando, { tipo: 'LANCE' }>,
): Estado {
  const l = s.leiloes.get(c.id);
  if (!l) return responder(s, c.cmdId, { status: 404 } satisfies ResultadoLance);
  const { participante, valor } = (c.corpo ?? {}) as Record<string, unknown>;
  if (
    typeof participante !== 'string' ||
    participante.trim() === '' ||
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    valor <= 0
  ) {
    return responder(s, c.cmdId, { status: 400 } satisfies ResultadoLance);
  }

  const { agora } = c;
  const encerraMs = Date.parse(l.encerraEm);
  if (l.status === 'ENCERRADO' || agora >= encerraMs) {
    return responder(encerrar(s, c.id, agora), c.cmdId, {
      status: 409,
      corpo: { aceito: false, motivo: 'LEILAO_ENCERRADO' },
    } satisfies ResultadoLance);
  }

  if (l.maiorLance?.participante === participante) {
    return responder(
      anexar(s, c.id, 'LanceRejeitado', agora, {
        participante,
        valor,
        motivo: 'PARTICIPANTE_JA_LIDERA',
      }),
      c.cmdId,
      {
        status: 422,
        corpo: { aceito: false, motivo: 'PARTICIPANTE_JA_LIDERA' },
      } satisfies ResultadoLance,
    );
  }

  const valorMinimo = l.maiorLance
    ? l.maiorLance.valor + l.incrementoMinimo
    : l.lanceInicial;
  if (valor < valorMinimo) {
    return responder(
      anexar(s, c.id, 'LanceRejeitado', agora, {
        participante,
        valor,
        motivo: 'VALOR_ABAIXO_DO_MINIMO',
      }),
      c.cmdId,
      {
        status: 422,
        corpo: { aceito: false, motivo: 'VALOR_ABAIXO_DO_MINIMO', valorMinimo },
      } satisfies ResultadoLance,
    );
  }

  const iso = new Date(agora).toISOString();
  const anterior = l.maiorLance;
  let atualizado: Leilao = {
    ...l,
    maiorLance: { participante, valor, ocorridoEm: iso },
    totalLances: l.totalLances + 1,
  };
  let n: Estado = { ...s, leiloes: com(s.leiloes, c.id, atualizado) };
  n = anexar(n, c.id, 'LanceAceito', agora, { participante, valor });
  if (anterior) {
    n = notificar(n, anterior.participante, {
      tipo: 'LANCE_SUPERADO',
      leilaoId: l.id,
      titulo: l.titulo,
      valorAnterior: anterior.valor,
      novoValor: valor,
      ocorridoEm: iso,
    });
  }
  if (
    l.prorrogacaoSegundos > 0 &&
    encerraMs - agora < l.prorrogacaoSegundos * 1000
  ) {
    const novoFim = new Date(agora + l.prorrogacaoSegundos * 1000).toISOString();
    atualizado = { ...atualizado, encerraEm: novoFim };
    n = { ...n, leiloes: com(n.leiloes, c.id, atualizado) };
    n = anexar(n, c.id, 'LeilaoProrrogado', agora, {
      encerraEmAnterior: l.encerraEm,
      encerraEm: novoFim,
    });
  }
  return responder(n, c.cmdId, {
    status: 201,
    corpo: { aceito: true, leilao: atualizado },
  } satisfies ResultadoLance);
}

function reduzir(s: Estado, c: Comando): Estado {
  switch (c.tipo) {
    case 'CRIAR': {
      const leilao: Leilao = {
        id: c.id,
        titulo: c.dto.titulo,
        lanceInicial: c.dto.lanceInicial,
        incrementoMinimo: c.dto.incrementoMinimo,
        prorrogacaoSegundos: c.dto.prorrogacaoSegundos,
        status: 'ABERTO',
        maiorLance: null,
        totalLances: 0,
        encerraEm: new Date(c.agora + c.dto.duracaoSegundos * 1000).toISOString(),
        vencedor: null,
      };
      const n = anexar(
        { ...s, leiloes: com(s.leiloes, c.id, leilao) },
        c.id,
        'LeilaoCriado',
        c.agora,
        {
          titulo: leilao.titulo,
          lanceInicial: leilao.lanceInicial,
          incrementoMinimo: leilao.incrementoMinimo,
          prorrogacaoSegundos: leilao.prorrogacaoSegundos,
          encerraEm: leilao.encerraEm,
        },
      );
      return responder(n, c.cmdId, leilao);
    }
    case 'LANCE':
      return lance(s, c);
    case 'TICK':
      return encerrarVencidos(s, c.agora);
  }
}

function proximoPrazo(s: Estado): number | null {
  let min: number | null = null;
  for (const l of s.leiloes.values()) {
    if (l.status !== 'ABERTO') continue;
    const t = Date.parse(l.encerraEm);
    if (min === null || t < min) min = t;
  }
  return min;
}

@Injectable()
export class LeilaoService implements OnModuleInit, OnModuleDestroy {
  private readonly comandos$ = new Subject<Comando>();
  private readonly destruir$ = new Subject<void>();

  // Comandos entram em ordem de chegada; scan os aplica um por vez.
  private readonly estado$: Observable<Estado> = this.comandos$.pipe(
    scan(reduzir, ESTADO_INICIAL),
    startWith(ESTADO_INICIAL),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  onModuleInit() {
    // Efeito: um único timer para o prazo mais próximo; reagenda quando ele muda
    // (novo leilão, prorrogação ou encerramento).
    this.estado$
      .pipe(
        map(proximoPrazo),
        distinctUntilChanged(),
        switchMap((prazo) =>
          prazo === null
            ? EMPTY
            : timer(Math.max(0, prazo - Date.now())).pipe(map(() => prazo)),
        ),
        takeUntil(this.destruir$),
      )
      .subscribe((prazo) =>
        this.comandos$.next({
          tipo: 'TICK',
          agora: Math.max(Date.now(), prazo),
        }),
      );
  }

  onModuleDestroy() {
    this.destruir$.next();
    this.destruir$.complete();
    this.comandos$.complete();
  }

  private enviar<T>(
    cmdId: string,
    montar: (agora: number) => Comando,
  ): Observable<T> {
    return merge(
      this.estado$.pipe(
        map((s) => s.saida),
        filter((o) => o?.cmdId === cmdId),
        take(1),
        map((o) => o!.resultado as T),
      ),
      defer(() => {
        this.comandos$.next(montar(Date.now()));
        return EMPTY;
      }),
    );
  }

  criar$(dto: NovoLeilao): Observable<Leilao> {
    const cmdId = randomUUID();
    const id = randomUUID();
    return this.enviar<Leilao>(cmdId, (agora) => ({
      tipo: 'CRIAR',
      cmdId,
      agora,
      id,
      dto,
    }));
  }

  darLance$(id: string, corpo: unknown): Observable<ResultadoLance> {
    const cmdId = randomUUID();
    return this.enviar<ResultadoLance>(cmdId, (agora) => ({
      tipo: 'LANCE',
      cmdId,
      agora,
      id,
      corpo,
    }));
  }

  listar$(): Observable<Leilao[]> {
    return this.estado$.pipe(
      take(1),
      map((s) => [...s.leiloes.values()]),
    );
  }

  obter$(id: string): Observable<Leilao | undefined> {
    return this.estado$.pipe(
      take(1),
      map((s) => s.leiloes.get(id)),
    );
  }

  eventos$(id: string): Observable<readonly Evento[] | undefined> {
    return this.estado$.pipe(
      take(1),
      map((s) => (s.leiloes.has(id) ? (s.eventos.get(id) ?? []) : undefined)),
    );
  }

  // Histórico + eventos novos, sem lacunas: cada estado emitido traz a lista completa
  // e só os eventos ainda não vistos são repassados.
  stream$(id: string): Observable<Evento> {
    return this.estado$.pipe(
      map((s) => s.eventos.get(id) ?? []),
      distinctUntilChanged(),
      scan(
        (acc, lista) => ({ vistos: lista.length, novos: lista.slice(acc.vistos) }),
        { vistos: 0, novos: [] as readonly Evento[] },
      ),
      concatMap((acc) => from(acc.novos)),
      takeWhile((e) => e.tipo !== 'LeilaoEncerrado', true),
    );
  }

  notificacoesDe$(nome: string): Observable<readonly Notificacao[]> {
    return this.estado$.pipe(
      take(1),
      map((s) => s.notificacoes.get(nome) ?? []),
    );
  }
}
