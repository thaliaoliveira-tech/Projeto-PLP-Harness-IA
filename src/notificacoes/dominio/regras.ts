import type { Evento } from '../../leiloes/dominio/tipos.js';
import type { EstadoNotificacoes, Notificacao } from './tipos.js';

export const ESTADO_INICIAL: EstadoNotificacoes = {
  titulos: new Map(),
  lideres: new Map(),
  porParticipante: new Map(),
};

function adicionar(estado: EstadoNotificacoes, participante: string, n: Notificacao): EstadoNotificacoes {
  return {
    ...estado,
    porParticipante: new Map(estado.porParticipante).set(participante, [
      ...(estado.porParticipante.get(participante) ?? []),
      n,
    ]),
  };
}

/** Redutor puro: projeta o log de eventos de leilões em notificações por participante. */
export function reduzir(estado: EstadoNotificacoes, evento: Evento): EstadoNotificacoes {
  const titulo = estado.titulos.get(evento.leilaoId) ?? '';
  switch (evento.tipo) {
    case 'LeilaoCriado':
      return { ...estado, titulos: new Map(estado.titulos).set(evento.leilaoId, evento.dados.titulo) };
    case 'LanceAceito': {
      const anterior = estado.lideres.get(evento.leilaoId);
      const { participante, valor } = evento.dados;
      const comLider: EstadoNotificacoes = {
        ...estado,
        lideres: new Map(estado.lideres).set(evento.leilaoId, { participante, valor }),
      };
      if (!anterior || anterior.participante === participante) return comLider;
      return adicionar(comLider, anterior.participante, {
        tipo: 'LANCE_SUPERADO',
        leilaoId: evento.leilaoId,
        titulo,
        valorAnterior: anterior.valor,
        novoValor: valor,
        ocorridoEm: evento.ocorridoEm,
      });
    }
    case 'LeilaoEncerrado': {
      const { vencedor, valor } = evento.dados;
      if (vencedor === null || valor === null) return estado;
      return adicionar(estado, vencedor, {
        tipo: 'LEILAO_VENCIDO',
        leilaoId: evento.leilaoId,
        titulo,
        valor,
        ocorridoEm: evento.ocorridoEm,
      });
    }
    default:
      return estado;
  }
}

export function notificacoesDe(estado: EstadoNotificacoes, participante: string): readonly Notificacao[] {
  return estado.porParticipante.get(participante) ?? [];
}
