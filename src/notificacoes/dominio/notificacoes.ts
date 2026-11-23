import type { Evento } from '../../leiloes/dominio/tipos.js';

export interface Notificacao {
  tipo: 'LANCE_SUPERADO' | 'LEILAO_VENCIDO';
  leilaoId: string;
  titulo: string;
  ocorridoEm: string;
  [campo: string]: unknown;
}

export interface EstadoNotificacoes {
  titulos: ReadonlyMap<string, string>;
  lideres: ReadonlyMap<string, { participante: string; valor: number }>;
  porParticipante: ReadonlyMap<string, readonly Notificacao[]>;
}

export const NOTIFICACOES_INICIAL: EstadoNotificacoes = {
  titulos: new Map(),
  lideres: new Map(),
  porParticipante: new Map(),
};

function adicionar(
  mapa: ReadonlyMap<string, readonly Notificacao[]>,
  nome: string,
  n: Notificacao,
): ReadonlyMap<string, readonly Notificacao[]> {
  return new Map(mapa).set(nome, [...(mapa.get(nome) ?? []), n]);
}

export function acumular(estado: EstadoNotificacoes, ev: Evento): EstadoNotificacoes {
  const titulo = estado.titulos.get(ev.leilaoId) ?? '';
  if (ev.tipo === 'LeilaoCriado') {
    return { ...estado, titulos: new Map(estado.titulos).set(ev.leilaoId, ev.dados['titulo'] as string) };
  }
  if (ev.tipo === 'LanceAceito') {
    const p = ev.dados['participante'] as string;
    const valor = ev.dados['valor'] as number;
    const anterior = estado.lideres.get(ev.leilaoId);
    const lideres = new Map(estado.lideres).set(ev.leilaoId, { participante: p, valor });
    if (anterior === undefined || anterior.participante === p) return { ...estado, lideres };
    return {
      ...estado,
      lideres,
      porParticipante: adicionar(estado.porParticipante, anterior.participante, {
        tipo: 'LANCE_SUPERADO',
        leilaoId: ev.leilaoId,
        titulo,
        valorAnterior: anterior.valor,
        novoValor: valor,
        ocorridoEm: ev.ocorridoEm,
      }),
    };
  }
  if (ev.tipo === 'LeilaoEncerrado') {
    const vencedor = ev.dados['vencedor'] as string | null;
    if (vencedor === null) return estado;
    return {
      ...estado,
      porParticipante: adicionar(estado.porParticipante, vencedor, {
        tipo: 'LEILAO_VENCIDO',
        leilaoId: ev.leilaoId,
        titulo,
        valor: ev.dados['valor'] as number,
        ocorridoEm: ev.ocorridoEm,
      }),
    };
  }
  return estado;
}
