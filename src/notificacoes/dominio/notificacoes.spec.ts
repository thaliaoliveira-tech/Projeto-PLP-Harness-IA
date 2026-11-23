import { describe, expect, it } from 'vitest';
import type { Evento } from '../../leiloes/dominio/tipos.js';
import { NOTIFICACOES_INICIAL, acumular } from './notificacoes.js';

const q = '2026-01-01T12:00:00.000Z';
const criado: Evento = { sequencia: 1, tipo: 'LeilaoCriado', leilaoId: 'L1', ocorridoEm: q, dados: { titulo: 'Bike' } };
const aceito = (sequencia: number, participante: string, valor: number): Evento => ({
  sequencia, tipo: 'LanceAceito', leilaoId: 'L1', ocorridoEm: q, dados: { participante, valor },
});

describe('acumular notificações', () => {
  it('avisa o líder anterior quando é superado', () => {
    const e = [criado, aceito(2, 'ana', 10), aceito(3, 'bia', 12)].reduce(acumular, NOTIFICACOES_INICIAL);
    expect(e.porParticipante.get('ana')).toEqual([
      { tipo: 'LANCE_SUPERADO', leilaoId: 'L1', titulo: 'Bike', valorAnterior: 10, novoValor: 12, ocorridoEm: q },
    ]);
    expect(e.porParticipante.get('bia')).toBeUndefined();
  });

  it('avisa o vencedor no encerramento', () => {
    const fim: Evento = { sequencia: 3, tipo: 'LeilaoEncerrado', leilaoId: 'L1', ocorridoEm: q, dados: { vencedor: 'ana', valor: 10 } };
    const e = [criado, aceito(2, 'ana', 10), fim].reduce(acumular, NOTIFICACOES_INICIAL);
    expect(e.porParticipante.get('ana')).toEqual([{ tipo: 'LEILAO_VENCIDO', leilaoId: 'L1', titulo: 'Bike', valor: 10, ocorridoEm: q }]);
  });

  it('é puro: não altera o estado recebido', () => {
    const antes = [criado, aceito(2, 'ana', 10)].reduce(acumular, NOTIFICACOES_INICIAL);
    acumular(antes, aceito(3, 'bia', 12));
    expect(antes.porParticipante.size).toBe(0);
  });
});
