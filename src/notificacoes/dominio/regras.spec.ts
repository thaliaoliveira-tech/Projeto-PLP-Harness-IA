import { describe, expect, it } from 'vitest';
import { NOTIFICACOES_INICIAL, notificacoesDe, reduzir } from './regras.js';
import type { EventoObservado } from './tipos.js';

const t = '2026-11-23T13:00:00.000Z';
const criado: EventoObservado = {
  tipo: 'LeilaoCriado',
  leilaoId: 'a',
  ocorridoEm: t,
  dados: { titulo: 'Bike' },
};
const lance = (participante: string, valor: number): EventoObservado => ({
  tipo: 'LanceAceito',
  leilaoId: 'a',
  ocorridoEm: t,
  dados: { participante, valor },
});
const aplicar = (...eventos: EventoObservado[]) =>
  eventos.reduce(reduzir, NOTIFICACOES_INICIAL);

describe('notificações', () => {
  it('o primeiro lance não notifica ninguém', () => {
    expect(aplicar(criado, lance('ana', 100)).porParticipante).toEqual({});
  });

  it('notifica quem foi superado, só uma vez por superação', () => {
    const e = aplicar(
      criado,
      lance('ana', 100),
      lance('bia', 110),
      lance('ana', 120),
    );
    expect(notificacoesDe(e, 'ana')).toEqual([
      {
        tipo: 'LANCE_SUPERADO',
        leilaoId: 'a',
        titulo: 'Bike',
        valorAnterior: 100,
        novoValor: 110,
        ocorridoEm: t,
      },
    ]);
    expect(notificacoesDe(e, 'bia')).toEqual([
      expect.objectContaining({ valorAnterior: 110, novoValor: 120 }),
    ]);
  });

  it('notifica o vencedor no encerramento', () => {
    const e = aplicar(criado, lance('ana', 100), {
      tipo: 'LeilaoEncerrado',
      leilaoId: 'a',
      ocorridoEm: t,
      dados: { vencedor: 'ana', valor: 100 },
    });
    expect(notificacoesDe(e, 'ana')).toEqual([
      {
        tipo: 'LEILAO_VENCIDO',
        leilaoId: 'a',
        titulo: 'Bike',
        valor: 100,
        ocorridoEm: t,
      },
    ]);
  });

  it('encerramento sem lances não notifica; participante desconhecido tem lista vazia', () => {
    const e = aplicar(criado, {
      tipo: 'LeilaoEncerrado',
      leilaoId: 'a',
      ocorridoEm: t,
      dados: { vencedor: null, valor: null },
    });
    expect(e.porParticipante).toEqual({});
    expect(notificacoesDe(e, 'zé')).toEqual([]);
  });

  it('ignora eventos sem efeito', () => {
    const e = aplicar(criado, {
      tipo: 'LanceRejeitado',
      leilaoId: 'a',
      ocorridoEm: t,
      dados: {},
    });
    expect(e).toEqual(aplicar(criado));
  });
});
