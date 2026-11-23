import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Observable,
  Subject,
  concat,
  concatMap,
  from,
  switchMap,
  takeWhile,
  timer,
} from 'rxjs';
import type {
  EventoLeilao,
  Leilao,
  ResultadoLance,
  TipoEvento,
} from './leilao.types.js';

interface Estado {
  leilao: Leilao;
  encerraEmMs: number;
  eventos: EventoLeilao[];
  eventos$: Subject<EventoLeilao>;
  prazo$: Subject<number>;
}

type Comando = () => void;

@Injectable()
export class LeilaoService implements OnModuleDestroy {
  private readonly leiloes = new Map<string, Estado>();
  /** Todos os eventos de todos os leilões (alimenta as notificações). */
  readonly todosEventos$ = new Subject<EventoLeilao>();
  /** Fila de comandos: tudo que muda estado passa por aqui, um de cada vez. */
  private readonly comandos$ = new Subject<Comando>();
  private readonly inscricao = this.comandos$
    .pipe(concatMap(async (cmd) => cmd()))
    .subscribe();

  onModuleDestroy() {
    this.inscricao.unsubscribe();
    for (const e of this.leiloes.values()) e.prazo$.complete();
  }

  private executar<T>(fn: () => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.comandos$.next(() => {
        try {
          resolve(fn());
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private emitir(
    e: Estado,
    tipo: TipoEvento,
    ocorridoEm: string,
    dados: Record<string, unknown>,
  ) {
    const ev: EventoLeilao = {
      sequencia: e.eventos.length + 1,
      tipo,
      leilaoId: e.leilao.id,
      ocorridoEm,
      dados,
    };
    e.eventos.push(ev);
    e.eventos$.next(ev);
    this.todosEventos$.next(ev);
  }

  // ---------- consultas ----------

  listar(): Leilao[] {
    return [...this.leiloes.values()].map((e) => ({ ...e.leilao }));
  }

  obter(id: string): Leilao | undefined {
    const e = this.leiloes.get(id);
    return e && { ...e.leilao };
  }

  eventos(id: string): EventoLeilao[] | undefined {
    return this.leiloes.get(id)?.eventos.slice();
  }

  /** Histórico seguido dos eventos novos; completa após LeilaoEncerrado. */
  stream(id: string): Observable<EventoLeilao> | undefined {
    const e = this.leiloes.get(id);
    if (!e) return undefined;
    // Tudo síncrono: não há janela entre o snapshot e a assinatura.
    const historico = e.eventos.slice();
    const encerrado = historico.at(-1)?.tipo === 'LeilaoEncerrado';
    if (encerrado) return from(historico);
    return concat(from(historico), e.eventos$).pipe(
      takeWhile((ev) => ev.tipo !== 'LeilaoEncerrado', true),
    );
  }

  // ---------- comandos ----------

  criar(dados: {
    titulo: string;
    lanceInicial: number;
    incrementoMinimo: number;
    duracaoSegundos: number;
    prorrogacaoSegundos: number;
  }): Promise<Leilao> {
    return this.executar(() => {
      const agora = Date.now();
      const encerraEmMs = agora + dados.duracaoSegundos * 1000;
      const leilao: Leilao = {
        id: randomUUID(),
        titulo: dados.titulo,
        lanceInicial: dados.lanceInicial,
        incrementoMinimo: dados.incrementoMinimo,
        prorrogacaoSegundos: dados.prorrogacaoSegundos,
        status: 'ABERTO',
        maiorLance: null,
        totalLances: 0,
        encerraEm: new Date(encerraEmMs).toISOString(),
        vencedor: null,
      };
      const estado: Estado = {
        leilao,
        encerraEmMs,
        eventos: [],
        eventos$: new Subject(),
        prazo$: new Subject(),
      };
      this.leiloes.set(leilao.id, estado);
      // Cada novo prazo cancela o timer anterior (prorrogação).
      estado.prazo$
        .pipe(switchMap((ms) => timer(Math.max(0, ms - Date.now()))))
        .subscribe(() => {
          void this.executar(() => this.encerrarSeVencido(estado));
        });
      this.emitir(estado, 'LeilaoCriado', new Date(agora).toISOString(), {
        titulo: leilao.titulo,
        lanceInicial: leilao.lanceInicial,
        incrementoMinimo: leilao.incrementoMinimo,
        prorrogacaoSegundos: leilao.prorrogacaoSegundos,
        encerraEm: leilao.encerraEm,
      });
      estado.prazo$.next(encerraEmMs);
      return { ...leilao };
    });
  }

  darLance(id: string, corpo: unknown): Promise<ResultadoLance> {
    return this.executar((): ResultadoLance => {
      const e = this.leiloes.get(id);
      if (!e) return { status: 404 };
      const b = corpo as Record<string, unknown> | null | undefined;
      const participante = b?.participante;
      const valor = b?.valor;
      if (
        typeof participante !== 'string' ||
        participante === '' ||
        typeof valor !== 'number' ||
        !Number.isFinite(valor) ||
        valor <= 0
      ) {
        return { status: 400 };
      }

      const agora = Date.now();
      this.encerrarSeVencido(e, agora);
      const l = e.leilao;
      if (l.status === 'ENCERRADO') {
        return {
          status: 409,
          corpo: { aceito: false, motivo: 'LEILAO_ENCERRADO' },
        };
      }
      const ocorridoEm = new Date(agora).toISOString();

      if (l.maiorLance?.participante === participante) {
        this.emitir(e, 'LanceRejeitado', ocorridoEm, {
          participante,
          valor,
          motivo: 'PARTICIPANTE_JA_LIDERA',
        });
        return {
          status: 422,
          corpo: { aceito: false, motivo: 'PARTICIPANTE_JA_LIDERA' },
        };
      }
      const valorMinimo = l.maiorLance
        ? l.maiorLance.valor + l.incrementoMinimo
        : l.lanceInicial;
      if (valor < valorMinimo) {
        this.emitir(e, 'LanceRejeitado', ocorridoEm, {
          participante,
          valor,
          motivo: 'VALOR_ABAIXO_DO_MINIMO',
        });
        return {
          status: 422,
          corpo: {
            aceito: false,
            motivo: 'VALOR_ABAIXO_DO_MINIMO',
            valorMinimo,
          },
        };
      }

      l.maiorLance = { participante, valor, ocorridoEm };
      l.totalLances++;
      this.emitir(e, 'LanceAceito', ocorridoEm, { participante, valor });

      const prorrog = l.prorrogacaoSegundos * 1000;
      if (prorrog > 0 && e.encerraEmMs - agora < prorrog) {
        const anterior = l.encerraEm;
        e.encerraEmMs = agora + prorrog;
        l.encerraEm = new Date(e.encerraEmMs).toISOString();
        this.emitir(e, 'LeilaoProrrogado', ocorridoEm, {
          encerraEmAnterior: anterior,
          encerraEm: l.encerraEm,
        });
        e.prazo$.next(e.encerraEmMs);
      }
      return { status: 201, corpo: { aceito: true, leilao: { ...l } } };
    });
  }

  private encerrarSeVencido(e: Estado, agora = Date.now()) {
    if (e.leilao.status === 'ENCERRADO') return;
    if (agora < e.encerraEmMs) {
      // Timer disparou ligeiramente antes do prazo: rearma.
      e.prazo$.next(e.encerraEmMs);
      return;
    }
    const l = e.leilao;
    l.status = 'ENCERRADO';
    l.vencedor = l.maiorLance?.participante ?? null;
    e.prazo$.complete();
    this.emitir(e, 'LeilaoEncerrado', new Date(e.encerraEmMs).toISOString(), {
      vencedor: l.vencedor,
      valor: l.maiorLance?.valor ?? null,
    });
  }
}
