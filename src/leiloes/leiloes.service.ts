import { HttpException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Observable,
  Subject,
  Subscription,
  concat,
  concatMap,
  defer,
  from,
  takeWhile,
  timer,
} from 'rxjs';
import type { EventoLeilao, Leilao, Notificacao, TipoEvento } from './leiloes.types.js';

interface CriarLeilaoDto {
  titulo: string;
  lanceInicial: number;
  incrementoMinimo: number;
  duracaoSegundos: number;
  prorrogacaoSegundos: number;
}

interface LanceCmd {
  id: string;
  participante: string;
  valor: number;
  resolve: (r: unknown) => void;
  reject: (e: unknown) => void;
}

interface Registro {
  leilao: Leilao;
  encerraEmMs: number;
  eventos: EventoLeilao[];
  live$: Subject<EventoLeilao>;
  timer?: Subscription;
}

/** Evento publicado no barramento global, usado para gerar notificações. */
interface Publicado {
  evento: EventoLeilao;
  leilao: Leilao;
  lanceAnterior?: { participante: string; valor: number };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;

@Injectable()
export class LeiloesService implements OnModuleDestroy {
  private readonly leiloes = new Map<string, Registro>();
  private readonly notificacoes = new Map<string, Notificacao[]>();
  private readonly barramento$ = new Subject<Publicado>();
  private readonly comandos$ = new Subject<LanceCmd>();
  private readonly subs = new Subscription();

  constructor() {
    // Lances são processados um por vez, na ordem de chegada.
    this.subs.add(
      this.comandos$
        .pipe(concatMap((cmd) => from(this.processarLance(cmd))))
        .subscribe(),
    );
    this.subs.add(this.barramento$.subscribe((p) => this.notificar(p)));
  }

  onModuleDestroy() {
    this.subs.unsubscribe();
    for (const r of this.leiloes.values()) r.timer?.unsubscribe();
  }

  criar(body: unknown): Leilao {
    const b = (body ?? {}) as Record<string, unknown>;
    const prorrog = b.prorrogacaoSegundos === undefined ? 0 : b.prorrogacaoSegundos;
    if (
      typeof body !== 'object' ||
      body === null ||
      !isStr(b.titulo) ||
      !isNum(b.lanceInicial) ||
      b.lanceInicial <= 0 ||
      !isNum(b.incrementoMinimo) ||
      b.incrementoMinimo <= 0 ||
      !isInt(b.duracaoSegundos, 1, 86400) ||
      !isInt(prorrog, 0, 3600)
    ) {
      throw new HttpException('Corpo inválido', 400);
    }
    const dto: CriarLeilaoDto = {
      titulo: b.titulo,
      lanceInicial: b.lanceInicial,
      incrementoMinimo: b.incrementoMinimo,
      duracaoSegundos: b.duracaoSegundos,
      prorrogacaoSegundos: prorrog,
    };
    const encerraEmMs = Date.now() + dto.duracaoSegundos * 1000;
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
    const reg: Registro = { leilao, encerraEmMs, eventos: [], live$: new Subject() };
    this.leiloes.set(leilao.id, reg);
    this.emitir(reg, 'LeilaoCriado', {
      titulo: leilao.titulo,
      lanceInicial: leilao.lanceInicial,
      incrementoMinimo: leilao.incrementoMinimo,
      prorrogacaoSegundos: leilao.prorrogacaoSegundos,
      encerraEm: leilao.encerraEm,
    });
    this.agendar(reg);
    return { ...leilao };
  }

  listar(): Leilao[] {
    return [...this.leiloes.values()].map((r) => ({ ...r.leilao }));
  }

  obter(id: string): Leilao {
    return { ...this.reg(id).leilao };
  }

  eventos(id: string): EventoLeilao[] {
    return [...this.reg(id).eventos];
  }

  stream(id: string): Observable<EventoLeilao> {
    const reg = this.reg(id);
    // defer + emissão síncrona do histórico e inscrição no ao vivo: nada se perde.
    return defer(() =>
      concat(from([...reg.eventos]), reg.live$).pipe(
        takeWhile((e) => e.tipo !== 'LeilaoEncerrado', true),
      ),
    );
  }

  notificacoesDe(nome: string): Notificacao[] {
    return [...(this.notificacoes.get(nome) ?? [])];
  }

  darLance(id: string, body: unknown): Promise<unknown> {
    this.reg(id); // 404 primeiro
    const b = (body ?? {}) as Record<string, unknown>;
    if (typeof body !== 'object' || body === null || !isStr(b.participante) || !isNum(b.valor) || b.valor <= 0) {
      throw new HttpException('Corpo inválido', 400);
    }
    const participante = b.participante;
    const valor = b.valor;
    return new Promise((resolve, reject) => {
      this.comandos$.next({ id, participante, valor, resolve, reject });
    });
  }

  private async processarLance(cmd: LanceCmd): Promise<void> {
    try {
      cmd.resolve(this.aplicarLance(cmd));
    } catch (e) {
      cmd.reject(e);
    }
  }

  private aplicarLance({ id, participante, valor }: LanceCmd) {
    const reg = this.reg(id);
    const l = reg.leilao;
    const agora = Date.now();
    if (l.status === 'ENCERRADO' || agora >= reg.encerraEmMs) {
      this.encerrar(reg);
      throw new HttpException({ aceito: false, motivo: 'LEILAO_ENCERRADO' }, 409);
    }
    const ts = new Date(agora).toISOString();
    if (l.maiorLance?.participante === participante) {
      this.emitir(reg, 'LanceRejeitado', { participante, valor, motivo: 'PARTICIPANTE_JA_LIDERA' }, ts);
      throw new HttpException({ aceito: false, motivo: 'PARTICIPANTE_JA_LIDERA' }, 422);
    }
    const valorMinimo = l.maiorLance ? l.maiorLance.valor + l.incrementoMinimo : l.lanceInicial;
    if (valor < valorMinimo) {
      this.emitir(reg, 'LanceRejeitado', { participante, valor, motivo: 'VALOR_ABAIXO_DO_MINIMO' }, ts);
      throw new HttpException(
        { aceito: false, motivo: 'VALOR_ABAIXO_DO_MINIMO', valorMinimo },
        422,
      );
    }
    const anterior = l.maiorLance ? { participante: l.maiorLance.participante, valor: l.maiorLance.valor } : undefined;
    l.maiorLance = { participante, valor, ocorridoEm: ts };
    l.totalLances++;
    this.emitir(reg, 'LanceAceito', { participante, valor }, ts, anterior);
    if (l.prorrogacaoSegundos > 0 && reg.encerraEmMs - agora < l.prorrogacaoSegundos * 1000) {
      const anteriorEncerra = l.encerraEm;
      reg.encerraEmMs = agora + l.prorrogacaoSegundos * 1000;
      l.encerraEm = new Date(reg.encerraEmMs).toISOString();
      this.emitir(reg, 'LeilaoProrrogado', { encerraEmAnterior: anteriorEncerra, encerraEm: l.encerraEm }, ts);
      this.agendar(reg);
    }
    return { aceito: true, leilao: { ...l } };
  }

  private agendar(reg: Registro) {
    reg.timer?.unsubscribe();
    const delay = Math.max(0, reg.encerraEmMs - Date.now());
    reg.timer = timer(delay).subscribe(() => {
      if (Date.now() < reg.encerraEmMs) this.agendar(reg); // disparou cedo
      else this.encerrar(reg);
    });
  }

  private encerrar(reg: Registro) {
    const l = reg.leilao;
    if (l.status === 'ENCERRADO') return;
    reg.timer?.unsubscribe();
    l.status = 'ENCERRADO';
    l.vencedor = l.maiorLance?.participante ?? null;
    this.emitir(reg, 'LeilaoEncerrado', {
      vencedor: l.vencedor,
      valor: l.maiorLance?.valor ?? null,
    });
    reg.live$.complete();
  }

  private emitir(
    reg: Registro,
    tipo: TipoEvento,
    dados: Record<string, unknown>,
    ocorridoEm = new Date().toISOString(),
    lanceAnterior?: Publicado['lanceAnterior'],
  ) {
    const evento: EventoLeilao = {
      sequencia: reg.eventos.length + 1,
      tipo,
      leilaoId: reg.leilao.id,
      ocorridoEm,
      dados,
    };
    reg.eventos.push(evento);
    reg.live$.next(evento);
    this.barramento$.next({ evento, leilao: { ...reg.leilao }, lanceAnterior });
  }

  private notificar({ evento, leilao, lanceAnterior }: Publicado) {
    const add = (nome: string, n: Notificacao) => {
      const lista = this.notificacoes.get(nome) ?? [];
      lista.push(n);
      this.notificacoes.set(nome, lista);
    };
    if (evento.tipo === 'LanceAceito' && lanceAnterior) {
      add(lanceAnterior.participante, {
        tipo: 'LANCE_SUPERADO',
        leilaoId: leilao.id,
        titulo: leilao.titulo,
        valorAnterior: lanceAnterior.valor,
        novoValor: evento.dados.valor as number,
        ocorridoEm: evento.ocorridoEm,
      });
    } else if (evento.tipo === 'LeilaoEncerrado' && leilao.maiorLance) {
      add(leilao.maiorLance.participante, {
        tipo: 'LEILAO_VENCIDO',
        leilaoId: leilao.id,
        titulo: leilao.titulo,
        valor: leilao.maiorLance.valor,
        ocorridoEm: evento.ocorridoEm,
      });
    }
  }

  private reg(id: string): Registro {
    const r = this.leiloes.get(id);
    if (!r) throw new NotFoundException('Leilão não encontrado');
    return r;
  }
}
