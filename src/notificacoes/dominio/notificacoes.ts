import type { EventoLeilao } from '../../leiloes/dominio/tipos.js';
import type { EstadoNotificacoes, Notificacao } from './tipos.js';

export const NOTIFICACOES_INICIAL: EstadoNotificacoes = {
  leiloes: new Map(),
  porParticipante: new Map(),
};

function adicionar(
  estado: EstadoNotificacoes,
  participante: string,
  n: Notificacao,
): EstadoNotificacoes {
  const lista = estado.porParticipante.get(participante) ?? [];
  return {
    ...estado,
    porParticipante: new Map(estado.porParticipante).set(participante, [
      ...lista,
      n,
    ]),
  };
}

/** Redutor puro: transforma o log de eventos de leilões em notificações por participante. */
export function reduzir(
  estado: EstadoNotificacoes,
  evento: EventoLeilao,
): EstadoNotificacoes {
  const info = estado.leiloes.get(evento.leilaoId);
  switch (evento.tipo) {
    case 'LeilaoCriado':
      return {
        ...estado,
        leiloes: new Map(estado.leiloes).set(evento.leilaoId, {
          titulo: evento.dados.titulo,
          lider: null,
        }),
      };
    case 'LanceAceito': {
      if (!info) return estado;
      const { participante, valor } = evento.dados;
      const atualizado = {
        ...estado,
        leiloes: new Map(estado.leiloes).set(evento.leilaoId, {
          ...info,
          lider: { participante, valor },
        }),
      };
      if (info.lider === null || info.lider.participante === participante)
        return atualizado;
      return adicionar(atualizado, info.lider.participante, {
        tipo: 'LANCE_SUPERADO',
        leilaoId: evento.leilaoId,
        titulo: info.titulo,
        valorAnterior: info.lider.valor,
        novoValor: valor,
        ocorridoEm: evento.ocorridoEm,
      });
    }
    case 'LeilaoEncerrado': {
      const { vencedor, valor } = evento.dados;
      if (!info || vencedor === null || valor === null) return estado;
      return adicionar(estado, vencedor, {
        tipo: 'LEILAO_VENCIDO',
        leilaoId: evento.leilaoId,
        titulo: info.titulo,
        valor,
        ocorridoEm: evento.ocorridoEm,
      });
    }
    default:
      return estado;
  }
}
