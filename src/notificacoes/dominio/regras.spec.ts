import { describe, expect, it } from 'vitest';
import type { Evento } from '../../leiloes/dominio/tipos.js';
import { ESTADO_INICIAL, notificacoesDe, reduzir } from './regras.js';

const T = '2026-11-23T13:00:00.000Z';
const criado = (id: string, titulo: string): Evento => ({
  sequencia: 1,
  tipo: 'LeilaoCriado',
  leilaoId: id,
  ocorridoEm: T,
  dados: { titulo, lanceInicial: 100, incrementoMinimo: 10, prorrogacaoSegundos: 0, encerraEm: T },
});
const lance = (id: string, participante: string, valor: number): Evento => ({
  sequencia: 2,
  tipo: 'LanceAceito',
  leilaoId: id,
  ocorridoEm: T,
  dados: { participante, valor },
});
const encerrado = (id: string, vencedor: string | null, valor: number | null): Evento => ({
  sequencia: 9,
  tipo: 'LeilaoEncerrado',
  leilaoId: id,
  ocorridoEm: T,
  dados: { vencedor, valor },
});
const rodar = (eventos: Evento[]) => eventos.reduce(reduzir, ESTADO_INICIAL);

describe('reduzir', () => {
  it('primeiro lance não notifica ninguém', () => {
    const e = rodar([criado('A', 'Bike'), lance('A', 'ana', 100)]);
    expect(notificacoesDe(e, 'ana')).toEqual([]);
  });

  it('notifica LANCE_SUPERADO ao líder anterior', () => {
    const e = rodar([criado('A', 'Bike'), lance('A', 'ana', 100), lance('A', 'bia', 110)]);
    expect(notificacoesDe(e, 'ana')).toEqual([
      { tipo: 'LANCE_SUPERADO', leilaoId: 'A', titulo: 'Bike', valorAnterior: 100, novoValor: 110, ocorridoEm: T },
    ]);
    expect(notificacoesDe(e, 'bia')).toEqual([]);
  });

  it('líderes são independentes por leilão', () => {
    const e = rodar([criado('A', 'Bike'), criado('B', 'Relógio'), lance('A', 'ana', 100), lance('B', 'bia', 100)]);
    expect(notificacoesDe(e, 'ana')).toEqual([]);
  });

  it('notifica LEILAO_VENCIDO ao vencedor, em ordem cronológica', () => {
    const e = rodar([
      criado('A', 'Bike'),
      lance('A', 'ana', 100),
      lance('A', 'bia', 110),
      lance('A', 'ana', 120),
      encerrado('A', 'ana', 120),
    ]);
    expect(notificacoesDe(e, 'ana').map((n) => n.tipo)).toEqual(['LANCE_SUPERADO', 'LEILAO_VENCIDO']);
    expect(notificacoesDe(e, 'bia').map((n) => n.tipo)).toEqual(['LANCE_SUPERADO']);
    expect(notificacoesDe(e, 'ana')[1]).toMatchObject({ valor: 120, titulo: 'Bike' });
  });

  it('encerramento sem lances não notifica', () => {
    expect(rodar([criado('A', 'Bike'), encerrado('A', null, null)]).porParticipante.size).toBe(0);
  });

  it('não altera o estado anterior', () => {
    const antes = rodar([criado('A', 'Bike'), lance('A', 'ana', 100)]);
    reduzir(antes, lance('A', 'bia', 110));
    expect(notificacoesDe(antes, 'ana')).toEqual([]);
  });
});
