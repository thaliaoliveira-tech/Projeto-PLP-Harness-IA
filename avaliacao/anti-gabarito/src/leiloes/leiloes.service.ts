// ANTI-GABARITO: implementação imperativa típica (funciona, mas viola as regras reativas).
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { NotificacoesService } from '../notificacoes/notificacoes.service.js';

export interface Lance {
  participante: string;
  valor: number;
  ocorridoEm: string;
}

export interface Leilao {
  id: string;
  titulo: string;
  lanceInicial: number;
  incrementoMinimo: number;
  prorrogacaoSegundos: number;
  status: 'ABERTO' | 'ENCERRADO';
  maiorLance: Lance | null;
  totalLances: number;
  encerraEm: string;
  vencedor: string | null;
}

export interface Evento {
  sequencia: number;
  tipo: string;
  leilaoId: string;
  ocorridoEm: string;
  dados: Record<string, unknown>;
}

export interface ResultadoLance {
  status: number;
  corpo: Record<string, unknown>;
}

@Injectable()
export class LeiloesService {
  private leiloes = new Map<string, Leilao>();
  private eventos = new Map<string, Evento[]>();
  private timers = new Map<string, NodeJS.Timeout>();
  readonly eventos$ = new Subject<Evento>();

  constructor(private readonly notificacoes: NotificacoesService) {}

  criar(dados: {
    titulo: string;
    lanceInicial: number;
    incrementoMinimo: number;
    duracaoSegundos: number;
    prorrogacaoSegundos: number;
  }): Leilao {
    const id = randomUUID();
    const agora = Date.now();
    const leilao: Leilao = {
      id,
      titulo: dados.titulo,
      lanceInicial: dados.lanceInicial,
      incrementoMinimo: dados.incrementoMinimo,
      prorrogacaoSegundos: dados.prorrogacaoSegundos,
      status: 'ABERTO',
      maiorLance: null,
      totalLances: 0,
      encerraEm: new Date(agora + dados.duracaoSegundos * 1000).toISOString(),
      vencedor: null,
    };
    this.leiloes.set(id, leilao);
    this.eventos.set(id, []);
    this.emitir(id, 'LeilaoCriado', {
      titulo: leilao.titulo,
      lanceInicial: leilao.lanceInicial,
      incrementoMinimo: leilao.incrementoMinimo,
      prorrogacaoSegundos: leilao.prorrogacaoSegundos,
      encerraEm: leilao.encerraEm,
    });
    this.agendarEncerramento(id);
    return { ...leilao };
  }

  listar(): Leilao[] {
    return [...this.leiloes.values()].map((l) => ({ ...l }));
  }

  buscar(id: string): Leilao | undefined {
    const l = this.leiloes.get(id);
    return l ? { ...l } : undefined;
  }

  historico(id: string): Evento[] {
    return [...(this.eventos.get(id) ?? [])];
  }

  darLance(id: string, participante: string, valor: number): ResultadoLance {
    const leilao = this.leiloes.get(id)!;
    if (leilao.status === 'ABERTO' && Date.now() >= Date.parse(leilao.encerraEm)) {
      this.encerrar(id);
    }
    if (leilao.status === 'ENCERRADO') {
      return { status: 409, corpo: { aceito: false, motivo: 'LEILAO_ENCERRADO' } };
    }
    if (leilao.maiorLance?.participante === participante) {
      this.emitir(id, 'LanceRejeitado', { participante, valor, motivo: 'PARTICIPANTE_JA_LIDERA' });
      return { status: 422, corpo: { aceito: false, motivo: 'PARTICIPANTE_JA_LIDERA' } };
    }
    const minimo = leilao.maiorLance
      ? leilao.maiorLance.valor + leilao.incrementoMinimo
      : leilao.lanceInicial;
    if (valor < minimo) {
      this.emitir(id, 'LanceRejeitado', { participante, valor, motivo: 'VALOR_ABAIXO_DO_MINIMO' });
      return {
        status: 422,
        corpo: { aceito: false, motivo: 'VALOR_ABAIXO_DO_MINIMO', valorMinimo: minimo },
      };
    }
    const anterior = leilao.maiorLance;
    const agora = Date.now();
    leilao.maiorLance = { participante, valor, ocorridoEm: new Date(agora).toISOString() };
    leilao.totalLances++;
    this.emitir(id, 'LanceAceito', { participante, valor });
    if (anterior && anterior.participante !== participante) {
      this.notificacoes.adicionar(anterior.participante, {
        tipo: 'LANCE_SUPERADO',
        leilaoId: id,
        titulo: leilao.titulo,
        valorAnterior: anterior.valor,
        novoValor: valor,
        ocorridoEm: new Date(agora).toISOString(),
      });
    }
    const janela = leilao.prorrogacaoSegundos * 1000;
    if (janela > 0 && Date.parse(leilao.encerraEm) - agora < janela) {
      const encerraEmAnterior = leilao.encerraEm;
      leilao.encerraEm = new Date(agora + janela).toISOString();
      this.emitir(id, 'LeilaoProrrogado', { encerraEmAnterior, encerraEm: leilao.encerraEm });
      this.agendarEncerramento(id);
    }
    return { status: 201, corpo: { aceito: true, leilao: { ...leilao } } };
  }

  private emitir(id: string, tipo: string, dados: Record<string, unknown>): void {
    const lista = this.eventos.get(id)!;
    const evento: Evento = {
      sequencia: lista.length + 1,
      tipo,
      leilaoId: id,
      ocorridoEm: new Date().toISOString(),
      dados,
    };
    lista.push(evento);
    this.eventos$.next(evento);
  }

  private agendarEncerramento(id: string): void {
    const leilao = this.leiloes.get(id)!;
    clearTimeout(this.timers.get(id));
    const ms = Math.max(0, Date.parse(leilao.encerraEm) - Date.now());
    this.timers.set(id, setTimeout(() => this.encerrar(id), ms));
  }

  private encerrar(id: string): void {
    const leilao = this.leiloes.get(id)!;
    if (leilao.status === 'ENCERRADO') return;
    leilao.status = 'ENCERRADO';
    leilao.vencedor = leilao.maiorLance?.participante ?? null;
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.emitir(id, 'LeilaoEncerrado', {
      vencedor: leilao.vencedor,
      valor: leilao.maiorLance?.valor ?? null,
    });
    if (leilao.maiorLance) {
      this.notificacoes.adicionar(leilao.maiorLance.participante, {
        tipo: 'LEILAO_VENCIDO',
        leilaoId: id,
        titulo: leilao.titulo,
        valor: leilao.maiorLance.valor,
        ocorridoEm: new Date().toISOString(),
      });
    }
  }
}
