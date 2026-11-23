// Projeção pura: eventos de leilão -> notificações por participante.
import type { EventoLeilao } from '../../leiloes/dominio/tipos.js';

export type Notificacao =
  | {
      readonly tipo: 'LANCE_SUPERADO';
      readonly leilaoId: string;
      readonly titulo: string;
      readonly valorAnterior: number;
      readonly novoValor: number;
      readonly ocorridoEm: string;
    }
  | {
      readonly tipo: 'LEILAO_VENCIDO';
      readonly leilaoId: string;
      readonly titulo: string;
      readonly valor: number;
      readonly ocorridoEm: string;
    };

interface Lider {
  readonly participante: string;
  readonly valor: number;
}

export interface EstadoNotificacoes {
  readonly titulos: ReadonlyMap<string, string>;
  readonly lideres: ReadonlyMap<string, Lider>;
  readonly porParticipante: ReadonlyMap<string, readonly Notificacao[]>;
}

export const NOTIFICACOES_INICIAL: EstadoNotificacoes = {
  titulos: new Map(),
  lideres: new Map(),
  porParticipante: new Map(),
};

const com = <K, V>(mapa: ReadonlyMap<K, V>, chave: K, valor: V): ReadonlyMap<K, V> =>
  new Map(mapa).set(chave, valor);

function notificar(
  porParticipante: ReadonlyMap<string, readonly Notificacao[]>,
  participante: string,
  notificacao: Notificacao,
): ReadonlyMap<string, readonly Notificacao[]> {
  return com(porParticipante, participante, [
    ...(porParticipante.get(participante) ?? []),
    notificacao,
  ]);
}

export function acumularNotificacoes(
  estado: EstadoNotificacoes,
  evento: EventoLeilao,
): EstadoNotificacoes {
  const titulo = estado.titulos.get(evento.leilaoId) ?? '';
  switch (evento.tipo) {
    case 'LeilaoCriado':
      return { ...estado, titulos: com(estado.titulos, evento.leilaoId, evento.dados.titulo) };
    case 'LanceAceito': {
      const anterior = estado.lideres.get(evento.leilaoId);
      const lideres = com(estado.lideres, evento.leilaoId, {
        participante: evento.dados.participante,
        valor: evento.dados.valor,
      });
      if (anterior === undefined || anterior.participante === evento.dados.participante) {
        return { ...estado, lideres };
      }
      return {
        ...estado,
        lideres,
        porParticipante: notificar(estado.porParticipante, anterior.participante, {
          tipo: 'LANCE_SUPERADO',
          leilaoId: evento.leilaoId,
          titulo,
          valorAnterior: anterior.valor,
          novoValor: evento.dados.valor,
          ocorridoEm: evento.ocorridoEm,
        }),
      };
    }
    case 'LeilaoEncerrado': {
      const { vencedor, valor } = evento.dados;
      if (vencedor === null || valor === null) return estado;
      return {
        ...estado,
        porParticipante: notificar(estado.porParticipante, vencedor, {
          tipo: 'LEILAO_VENCIDO',
          leilaoId: evento.leilaoId,
          titulo,
          valor,
          ocorridoEm: evento.ocorridoEm,
        }),
      };
    }
    default:
      return estado;
  }
}
