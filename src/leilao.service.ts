import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Observable,
  Subject,
  Subscription,
  concat,
  concatMap,
  defer,
  from,
  of,
  switchMap,
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

interface Registro {
  leilao: Leilao;
  eventos: Evento[];
  ao$: Subject<Evento>;
  agendar$: Subject<number>;
  encerraEmMs: number;
}

export interface NovoLeilao {
  titulo: string;
  lanceInicial: number;
  incrementoMinimo: number;
  duracaoSegundos: number;
  prorrogacaoSegundos: number;
}

@Injectable()
export class LeilaoService implements OnModuleDestroy {
  private readonly registros = new Map<string, Registro>();
  private readonly notificacoes = new Map<string, Notificacao[]>();
  private readonly subs = new Subscription();

  // Fila de comandos: tudo que muda estado passa por aqui, um por vez, em ordem de chegada.
  private readonly comandos$ = new Subject<() => void>();

  constructor() {
    this.subs.add(
      this.comandos$.pipe(concatMap((cmd) => of(cmd()))).subscribe(),
    );
  }

  onModuleDestroy() {
    this.subs.unsubscribe();
    for (const r of this.registros.values()) r.agendar$.complete();
  }

  private executar<T>(fn: () => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.comandos$.next(() => {
        try {
          resolve(fn());
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  criar(dto: NovoLeilao): Promise<Leilao> {
    return this.executar(() => {
      const agora = Date.now();
      const encerraEmMs = agora + dto.duracaoSegundos * 1000;
      const leilao: Leilao = {
        id: randomUUID(),
        titulo: dto.titulo,
        lanceInicial: dto.lanceInicial,
        incrementoMinimo: dto.incrementoMinimo,
        prorrogacaoSegundos: dto.prorrogacaoSegundos,
        status: 'ABERTO',
        maiorLance: null,
        totalLances: 0,
        encerraEm: new Date(encerraEmMs).toISOString(),
        vencedor: null,
      };
      const r: Registro = {
        leilao,
        eventos: [],
        ao$: new Subject<Evento>(),
        agendar$: new Subject<number>(),
        encerraEmMs,
      };
      this.registros.set(leilao.id, r);

      // Cada novo prazo cancela o timer anterior e agenda o encerramento.
      this.subs.add(
        r.agendar$
          .pipe(
            switchMap((alvo) => timer(Math.max(0, alvo - Date.now()))),
          )
          .subscribe(() => {
            void this.executar(() => this.tentarEncerrar(r));
          }),
      );

      this.emitir(r, 'LeilaoCriado', new Date(agora), {
        titulo: leilao.titulo,
        lanceInicial: leilao.lanceInicial,
        incrementoMinimo: leilao.incrementoMinimo,
        prorrogacaoSegundos: leilao.prorrogacaoSegundos,
        encerraEm: leilao.encerraEm,
      });
      r.agendar$.next(encerraEmMs);
      return { ...leilao };
    });
  }

  listar(): Leilao[] {
    return [...this.registros.values()].map((r) => ({ ...r.leilao }));
  }

  obter(id: string): Leilao | undefined {
    const r = this.registros.get(id);
    return r && { ...r.leilao };
  }

  eventos(id: string): Evento[] | undefined {
    return this.registros.get(id)?.eventos.slice();
  }

  stream(id: string): Observable<Evento> | undefined {
    const r = this.registros.get(id);
    if (!r) return undefined;
    return defer(() =>
      concat(from(r.eventos.slice()), r.ao$).pipe(
        takeWhile((e) => e.tipo !== 'LeilaoEncerrado', true),
      ),
    );
  }

  notificacoesDe(nome: string): Notificacao[] {
    return (this.notificacoes.get(nome) ?? []).slice();
  }

  darLance(id: string, corpo: unknown): Promise<ResultadoLance> {
    return this.executar<ResultadoLance>(() => {
      const r = this.registros.get(id);
      if (!r) return { status: 404 };
      const c = (corpo ?? {}) as Record<string, unknown>;
      const { participante, valor } = c;
      if (
        typeof participante !== 'string' ||
        participante.trim() === '' ||
        typeof valor !== 'number' ||
        !Number.isFinite(valor) ||
        valor <= 0
      ) {
        return { status: 400 };
      }

      const l = r.leilao;
      const agora = Date.now();
      if (l.status === 'ENCERRADO' || agora >= r.encerraEmMs) {
        this.tentarEncerrar(r);
        return {
          status: 409,
          corpo: { aceito: false, motivo: 'LEILAO_ENCERRADO' },
        };
      }

      const data = new Date(agora);
      if (l.maiorLance?.participante === participante) {
        this.emitir(r, 'LanceRejeitado', data, {
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
        this.emitir(r, 'LanceRejeitado', data, {
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

      const anterior = l.maiorLance;
      l.maiorLance = { participante, valor, ocorridoEm: data.toISOString() };
      l.totalLances++;
      this.emitir(r, 'LanceAceito', data, { participante, valor });
      if (anterior) {
        this.notificar(anterior.participante, {
          tipo: 'LANCE_SUPERADO',
          leilaoId: l.id,
          titulo: l.titulo,
          valorAnterior: anterior.valor,
          novoValor: valor,
          ocorridoEm: data.toISOString(),
        });
      }

      if (
        l.prorrogacaoSegundos > 0 &&
        r.encerraEmMs - agora < l.prorrogacaoSegundos * 1000
      ) {
        const anteriorIso = l.encerraEm;
        r.encerraEmMs = agora + l.prorrogacaoSegundos * 1000;
        l.encerraEm = new Date(r.encerraEmMs).toISOString();
        this.emitir(r, 'LeilaoProrrogado', data, {
          encerraEmAnterior: anteriorIso,
          encerraEm: l.encerraEm,
        });
        r.agendar$.next(r.encerraEmMs);
      }
      return { status: 201, corpo: { aceito: true, leilao: { ...l } } };
    });
  }

  private tentarEncerrar(r: Registro): void {
    const l = r.leilao;
    if (l.status === 'ENCERRADO') return;
    const agora = Date.now();
    if (agora < r.encerraEmMs) {
      r.agendar$.next(r.encerraEmMs); // timer disparou cedo demais
      return;
    }
    l.status = 'ENCERRADO';
    l.vencedor = l.maiorLance?.participante ?? null;
    const data = new Date(agora);
    this.emitir(r, 'LeilaoEncerrado', data, {
      vencedor: l.vencedor,
      valor: l.maiorLance?.valor ?? null,
    });
    if (l.maiorLance) {
      this.notificar(l.maiorLance.participante, {
        tipo: 'LEILAO_VENCIDO',
        leilaoId: l.id,
        titulo: l.titulo,
        valor: l.maiorLance.valor,
        ocorridoEm: data.toISOString(),
      });
    }
    r.agendar$.complete();
    r.ao$.complete();
  }

  private emitir(
    r: Registro,
    tipo: TipoEvento,
    data: Date,
    dados: Record<string, unknown>,
  ): void {
    const evento: Evento = {
      sequencia: r.eventos.length + 1,
      tipo,
      leilaoId: r.leilao.id,
      ocorridoEm: data.toISOString(),
      dados,
    };
    r.eventos.push(evento);
    r.ao$.next(evento);
  }

  private notificar(nome: string, n: Notificacao): void {
    const lista = this.notificacoes.get(nome) ?? [];
    lista.push(n);
    this.notificacoes.set(nome, lista);
  }
}

