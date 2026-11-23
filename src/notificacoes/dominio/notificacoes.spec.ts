import { describe, expect, it } from 'vitest';
import type { EventoLeilao } from '../../leiloes/dominio/tipos.js';
import { NOTIFICACOES_INICIAL, reduzir } from './notificacoes.js';

const base = { leilaoId: 'L1', ocorridoEm: '2026-11-23T13:00:00.000Z' };
const eventos: EventoLeilao[] = [
  {
    ...base,
    sequencia: 1,
    tipo: 'LeilaoCriado',
    dados: {
      titulo: 'Bike',
      lanceInicial: 100,
      incrementoMinimo: 10,
      prorrogacaoSegundos: 0,
      encerraEm: 'x',
    },
  },
  {
    ...base,
    sequencia: 2,
    tipo: 'LanceAceito',
    dados: { participante: 'ana', valor: 100 },
  },
  {
    ...base,
    sequencia: 3,
    tipo: 'LanceRejeitado',
    dados: { participante: 'bia', valor: 5, motivo: 'VALOR_ABAIXO_DO_MINIMO' },
  },
  {
    ...base,
    sequencia: 4,
    tipo: 'LanceAceito',
    dados: { participante: 'bia', valor: 110 },
  },
  {
    ...base,
    sequencia: 5,
    tipo: 'LeilaoEncerrado',
    dados: { vencedor: 'bia', valor: 110 },
  },
];

describe('reduzir', () => {
  const final = eventos.reduce(reduzir, NOTIFICACOES_INICIAL);

  it('notifica quem foi superado', () => {
    expect(final.porParticipante.get('ana')).toEqual([
      {
        tipo: 'LANCE_SUPERADO',
        leilaoId: 'L1',
        titulo: 'Bike',
        valorAnterior: 100,
        novoValor: 110,
        ocorridoEm: base.ocorridoEm,
      },
    ]);
  });

  it('notifica o vencedor, e não notifica o primeiro lance', () => {
    expect(final.porParticipante.get('bia')).toEqual([
      {
        tipo: 'LEILAO_VENCIDO',
        leilaoId: 'L1',
        titulo: 'Bike',
        valor: 110,
        ocorridoEm: base.ocorridoEm,
      },
    ]);
  });

  it('encerramento sem lances não notifica ninguém', () => {
    const e = [
      eventos[0],
      {
        ...base,
        sequencia: 2,
        tipo: 'LeilaoEncerrado',
        dados: { vencedor: null, valor: null },
      } as EventoLeilao,
    ];
    expect(e.reduce(reduzir, NOTIFICACOES_INICIAL).porParticipante.size).toBe(
      0,
    );
  });

  it('não altera o estado anterior', () => {
    const parcial = eventos.slice(0, 2).reduce(reduzir, NOTIFICACOES_INICIAL);
    reduzir(parcial, eventos[3]);
    expect(parcial.porParticipante.size).toBe(0);
  });
});
