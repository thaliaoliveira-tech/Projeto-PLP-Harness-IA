import { describe, expect, it } from 'vitest';
import type { EventoLeilao } from '../../leiloes/dominio/tipos.js';
import { NOTIFICACOES_INICIAL, acumularNotificacoes } from './notificacoes.js';

const quando = '2026-01-01T12:00:00.000Z';
const criado: EventoLeilao = {
  sequencia: 1,
  tipo: 'LeilaoCriado',
  leilaoId: 'L1',
  ocorridoEm: quando,
  dados: { titulo: 'Bike', lanceInicial: 10, incrementoMinimo: 1, prorrogacaoSegundos: 0, encerraEm: quando },
};
const aceito = (sequencia: number, participante: string, valor: number): EventoLeilao => ({
  sequencia,
  tipo: 'LanceAceito',
  leilaoId: 'L1',
  ocorridoEm: quando,
  dados: { participante, valor },
});

describe('acumularNotificacoes', () => {
  it('notifica LANCE_SUPERADO ao líder anterior quando outro participante assume', () => {
    const estado = [criado, aceito(2, 'ana', 10), aceito(3, 'bia', 12)].reduce(acumularNotificacoes, NOTIFICACOES_INICIAL);
    expect(estado.porParticipante.get('ana')).toEqual([
      { tipo: 'LANCE_SUPERADO', leilaoId: 'L1', titulo: 'Bike', valorAnterior: 10, novoValor: 12, ocorridoEm: quando },
    ]);
    expect(estado.porParticipante.get('bia')).toBeUndefined();
  });

  it('notifica LEILAO_VENCIDO ao vencedor no encerramento', () => {
    const encerrado: EventoLeilao = {
      sequencia: 3,
      tipo: 'LeilaoEncerrado',
      leilaoId: 'L1',
      ocorridoEm: quando,
      dados: { vencedor: 'ana', valor: 10 },
    };
    const estado = [criado, aceito(2, 'ana', 10), encerrado].reduce(acumularNotificacoes, NOTIFICACOES_INICIAL);
    expect(estado.porParticipante.get('ana')).toEqual([
      { tipo: 'LEILAO_VENCIDO', leilaoId: 'L1', titulo: 'Bike', valor: 10, ocorridoEm: quando },
    ]);
  });

  it('é puro: não altera o estado recebido', () => {
    const antes = [criado, aceito(2, 'ana', 10)].reduce(acumularNotificacoes, NOTIFICACOES_INICIAL);
    acumularNotificacoes(antes, aceito(3, 'bia', 12));
    expect(antes.porParticipante.size).toBe(0);
  });
});
