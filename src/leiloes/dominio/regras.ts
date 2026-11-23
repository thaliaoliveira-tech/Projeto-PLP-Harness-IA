import type { Comando, Entrada, Estado, Evento, Leilao, Motivo, Processamento, Resultado } from './tipos.js';

export const ESTADO_INICIAL: Estado = new Map();

export const PROCESSAMENTO_INICIAL: Processamento = {
  entradaId: null,
  estado: ESTADO_INICIAL,
  eventos: [],
  resultado: { tipo: 'Nada' },
};

const iso = (ms: number): string => new Date(ms).toISOString();

export function valorMinimo(l: Leilao): number {
  return l.maiorLance === null ? l.lanceInicial : l.maiorLance.valor + l.incrementoMinimo;
}

export function aplicar(estado: Estado, ev: Evento): Estado {
  const antigo = estado.get(ev.leilaoId);
  const novo = new Map(estado);
  let leilao: Leilao;
  if (ev.tipo === 'LeilaoCriado') {
    const d = ev.dados as { titulo: string; lanceInicial: number; incrementoMinimo: number; prorrogacaoSegundos: number; encerraEm: string };
    leilao = {
      id: ev.leilaoId,
      titulo: d.titulo,
      lanceInicial: d.lanceInicial,
      incrementoMinimo: d.incrementoMinimo,
      prorrogacaoSegundos: d.prorrogacaoSegundos,
      status: 'ABERTO',
      maiorLance: null,
      totalLances: 0,
      encerraEm: d.encerraEm,
      vencedor: null,
    };
  } else {
    if (antigo === undefined) throw new Error('leilão inexistente');
    leilao = antigo.leilao;
    if (ev.tipo === 'LanceAceito') {
      const d = ev.dados as { participante: string; valor: number };
      leilao = {
        ...leilao,
        maiorLance: { participante: d.participante, valor: d.valor, ocorridoEm: ev.ocorridoEm },
        totalLances: leilao.totalLances + 1,
      };
    } else if (ev.tipo === 'LeilaoProrrogado') {
      leilao = { ...leilao, encerraEm: (ev.dados as { encerraEm: string }).encerraEm };
    } else if (ev.tipo === 'LeilaoEncerrado') {
      leilao = { ...leilao, status: 'ENCERRADO', vencedor: (ev.dados as { vencedor: string | null }).vencedor };
    }
  }
  novo.set(ev.leilaoId, { leilao, eventos: [...(antigo?.eventos ?? []), ev] });
  return novo;
}

function encerramento(l: Leilao, seq: number, quando: number): Evento {
  return {
    sequencia: seq,
    tipo: 'LeilaoEncerrado',
    leilaoId: l.id,
    ocorridoEm: iso(quando),
    dados: { vencedor: l.maiorLance?.participante ?? null, valor: l.maiorLance?.valor ?? null },
  };
}

interface Decisao {
  eventos: Evento[];
  resultado: Resultado;
}

export function decidir(estado: Estado, cmd: Comando, instante: number): Decisao {
  if (cmd.tipo === 'Criar') {
    if (estado.has(cmd.leilaoId)) return { eventos: [], resultado: { tipo: 'Nada' } };
    const ev: Evento = {
      sequencia: 1,
      tipo: 'LeilaoCriado',
      leilaoId: cmd.leilaoId,
      ocorridoEm: iso(instante),
      dados: {
        titulo: cmd.titulo,
        lanceInicial: cmd.lanceInicial,
        incrementoMinimo: cmd.incrementoMinimo,
        prorrogacaoSegundos: cmd.prorrogacaoSegundos,
        encerraEm: iso(instante + cmd.duracaoSegundos * 1000),
      },
    };
    return { eventos: [ev], resultado: { tipo: 'Nada' } };
  }

  const atual = estado.get(cmd.leilaoId);
  if (atual === undefined) return { eventos: [], resultado: { tipo: 'NaoEncontrado' } };
  const l = atual.leilao;
  const seq = atual.eventos.length + 1;

  if (cmd.tipo === 'Encerrar') {
    // só vale se o prazo agendado ainda é o vigente
    if (l.status !== 'ABERTO' || l.encerraEm !== cmd.prazo) return { eventos: [], resultado: { tipo: 'Nada' } };
    return { eventos: [encerramento(l, seq, Math.max(instante, Date.parse(cmd.prazo)))], resultado: { tipo: 'Nada' } };
  }

  // Lance
  if (l.status === 'ENCERRADO') return { eventos: [], resultado: { tipo: 'Recusado', motivo: 'LEILAO_ENCERRADO' } };
  if (instante >= Date.parse(l.encerraEm)) {
    return { eventos: [encerramento(l, seq, instante)], resultado: { tipo: 'Recusado', motivo: 'LEILAO_ENCERRADO' } };
  }
  const minimo = valorMinimo(l);
  let motivo: Motivo | null = null;
  if (l.maiorLance?.participante === cmd.participante) motivo = 'PARTICIPANTE_JA_LIDERA';
  else if (cmd.valor < minimo) motivo = 'VALOR_ABAIXO_DO_MINIMO';
  if (motivo !== null) {
    const rejeitado: Evento = {
      sequencia: seq,
      tipo: 'LanceRejeitado',
      leilaoId: l.id,
      ocorridoEm: iso(instante),
      dados: { participante: cmd.participante, valor: cmd.valor, motivo },
    };
    const resultado: Resultado =
      motivo === 'VALOR_ABAIXO_DO_MINIMO'
        ? { tipo: 'Recusado', motivo, valorMinimo: minimo }
        : { tipo: 'Recusado', motivo };
    return { eventos: [rejeitado], resultado };
  }
  const aceito: Evento = {
    sequencia: seq,
    tipo: 'LanceAceito',
    leilaoId: l.id,
    ocorridoEm: iso(instante),
    dados: { participante: cmd.participante, valor: cmd.valor },
  };
  const janela = l.prorrogacaoSegundos * 1000;
  if (janela > 0 && Date.parse(l.encerraEm) - instante < janela) {
    const prorrogado: Evento = {
      sequencia: seq + 1,
      tipo: 'LeilaoProrrogado',
      leilaoId: l.id,
      ocorridoEm: iso(instante),
      dados: { encerraEmAnterior: l.encerraEm, encerraEm: iso(instante + janela) },
    };
    return { eventos: [aceito, prorrogado], resultado: { tipo: 'Nada' } };
  }
  return { eventos: [aceito], resultado: { tipo: 'Nada' } };
}

export function processar(estado: Estado, entrada: Entrada): Processamento {
  const d = decidir(estado, entrada.comando, entrada.instante);
  const novo = d.eventos.reduce(aplicar, estado);
  let resultado = d.resultado;
  if (resultado.tipo === 'Nada' && entrada.comando.tipo !== 'Encerrar') {
    const l = novo.get(entrada.comando.leilaoId)?.leilao;
    if (l !== undefined) resultado = { tipo: 'Ok', leilao: l };
  }
  return { entradaId: entrada.id, estado: novo, eventos: d.eventos, resultado };
}
