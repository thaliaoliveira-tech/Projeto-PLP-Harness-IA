import type {
  EstadoNotificacoes,
  EventoObservado,
  Notificacao,
} from './tipos.js';

export const NOTIFICACOES_INICIAL: EstadoNotificacoes = {
  leiloes: {},
  porParticipante: {},
};

function adicionar(
  estado: EstadoNotificacoes,
  participante: string,
  notificacao: Notificacao,
): EstadoNotificacoes {
  return {
    ...estado,
    porParticipante: {
      ...estado.porParticipante,
      [participante]: [
        ...(estado.porParticipante[participante] ?? []),
        notificacao,
      ],
    },
  };
}

/** Redutor puro: cada evento de leilão pode gerar notificações. */
export function reduzir(
  estado: EstadoNotificacoes,
  evento: EventoObservado,
): EstadoNotificacoes {
  const leilao = estado.leiloes[evento.leilaoId];
  switch (evento.tipo) {
    case 'LeilaoCriado':
      return {
        ...estado,
        leiloes: {
          ...estado.leiloes,
          [evento.leilaoId]: { titulo: evento.dados.titulo, lider: null },
        },
      };
    case 'LanceAceito': {
      if (!leilao) return estado;
      const { participante, valor } = evento.dados;
      const atualizado: EstadoNotificacoes = {
        ...estado,
        leiloes: {
          ...estado.leiloes,
          [evento.leilaoId]: { ...leilao, lider: { participante, valor } },
        },
      };
      const anterior = leilao.lider;
      if (!anterior || anterior.participante === participante)
        return atualizado;
      return adicionar(atualizado, anterior.participante, {
        tipo: 'LANCE_SUPERADO',
        leilaoId: evento.leilaoId,
        titulo: leilao.titulo,
        valorAnterior: anterior.valor,
        novoValor: valor,
        ocorridoEm: evento.ocorridoEm,
      });
    }
    case 'LeilaoEncerrado': {
      const { vencedor, valor } = evento.dados;
      if (!leilao || vencedor === null || valor === null) return estado;
      return adicionar(estado, vencedor, {
        tipo: 'LEILAO_VENCIDO',
        leilaoId: evento.leilaoId,
        titulo: leilao.titulo,
        valor,
        ocorridoEm: evento.ocorridoEm,
      });
    }
    default:
      return estado;
  }
}

export function notificacoesDe(
  estado: EstadoNotificacoes,
  participante: string,
): readonly Notificacao[] {
  return estado.porParticipante[participante] ?? [];
}
