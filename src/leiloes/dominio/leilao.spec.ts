import { describe, expect, it } from 'vitest';
import {
  decidir,
  ESTADO_INICIAL,
  evoluir,
  paraLeilao,
  valorMinimo,
} from './leilao.js';
import type { Comando, EstadoLeiloes } from './tipos.js';

const T0 = Date.parse('2026-11-23T13:00:00.000Z');
const dados = {
  titulo: 'Bike',
  lanceInicial: 100,
  incrementoMinimo: 10,
  duracaoSegundos: 60,
  prorrogacaoSegundos: 5,
};

function aplicar(estado: EstadoLeiloes, comando: Comando, instante: number) {
  const d = decidir(estado, comando, instante);
  return { ...d, estado: d.eventos.reduce(evoluir, estado) };
}
const lance = (participante: string, valor: number): Comando => ({
  tipo: 'DarLance',
  leilaoId: 'L1',
  dados: { participante, valor },
});
const criado = (extra = {}) =>
  aplicar(
    ESTADO_INICIAL,
    { tipo: 'CriarLeilao', id: 'L1', dados: { ...dados, ...extra } },
    T0,
  ).estado;

describe('decidir/evoluir', () => {
  it('cria o leilão com encerraEm = agora + duração', () => {
    const r = aplicar(
      ESTADO_INICIAL,
      { tipo: 'CriarLeilao', id: 'L1', dados },
      T0,
    );
    expect(r.eventos).toHaveLength(1);
    expect(r.eventos[0]).toMatchObject({
      sequencia: 1,
      tipo: 'LeilaoCriado',
      dados: { encerraEm: '2026-11-23T13:01:00.000Z' },
    });
    expect(paraLeilao(r.estado.leiloes.get('L1')!)).toEqual({
      id: 'L1',
      titulo: 'Bike',
      lanceInicial: 100,
      incrementoMinimo: 10,
      prorrogacaoSegundos: 5,
      status: 'ABERTO',
      maiorLance: null,
      totalLances: 0,
      encerraEm: '2026-11-23T13:01:00.000Z',
      vencedor: null,
    });
  });

  it('aceita lance igual ao mínimo inicial e depois exige incremento', () => {
    let r = aplicar(criado(), lance('ana', 100), T0 + 1000);
    expect(r.resultado.tipo).toBe('LANCE_ACEITO');
    expect(valorMinimo(r.estado.leiloes.get('L1')!)).toBe(110);
    r = aplicar(r.estado, lance('bia', 109), T0 + 2000);
    expect(r.resultado).toEqual({
      tipo: 'LANCE_RECUSADO',
      motivo: 'VALOR_ABAIXO_DO_MINIMO',
      valorMinimo: 110,
    });
    expect(r.eventos[0]).toMatchObject({
      tipo: 'LanceRejeitado',
      sequencia: 3,
    });
    r = aplicar(r.estado, lance('bia', 110), T0 + 3000);
    expect(r.resultado.tipo).toBe('LANCE_ACEITO');
    expect(r.estado.leiloes.get('L1')!.totalLances).toBe(2);
  });

  it('recusa quem já lidera', () => {
    const e = aplicar(criado(), lance('ana', 100), T0 + 1000).estado;
    const r = aplicar(e, lance('ana', 500), T0 + 2000);
    expect(r.resultado).toEqual({
      tipo: 'LANCE_RECUSADO',
      motivo: 'PARTICIPANTE_JA_LIDERA',
    });
  });

  it('recusa lance no instante de encerramento sem gerar evento', () => {
    const r = aplicar(criado(), lance('ana', 100), T0 + 60000);
    expect(r.resultado).toEqual({
      tipo: 'LANCE_RECUSADO',
      motivo: 'LEILAO_ENCERRADO',
    });
    expect(r.eventos).toEqual([]);
  });

  it('lance inexistente', () => {
    expect(decidir(ESTADO_INICIAL, lance('ana', 1), T0).resultado.tipo).toBe(
      'LEILAO_INEXISTENTE',
    );
  });

  it('prorroga somente quando falta menos que a janela', () => {
    const e = criado();
    expect(
      aplicar(e, lance('ana', 100), T0 + 55000).eventos.map((x) => x.tipo),
    ).toEqual(['LanceAceito']);
    const r = aplicar(e, lance('ana', 100), T0 + 55001);
    expect(r.eventos.map((x) => x.tipo)).toEqual([
      'LanceAceito',
      'LeilaoProrrogado',
    ]);
    expect(r.eventos[1]).toMatchObject({
      sequencia: 3,
      dados: {
        encerraEmAnterior: '2026-11-23T13:01:00.000Z',
        encerraEm: '2026-11-23T13:01:00.001Z',
      },
    });
    expect(r.estado.leiloes.get('L1')!.encerraEm).toBe(
      '2026-11-23T13:01:00.001Z',
    );
  });

  it('não prorroga com prorrogacaoSegundos = 0', () => {
    const r = aplicar(
      criado({ prorrogacaoSegundos: 0 }),
      lance('ana', 100),
      T0 + 59999,
    );
    expect(r.eventos.map((x) => x.tipo)).toEqual(['LanceAceito']);
  });

  it('encerra com o vencedor e ignora comandos obsoletos ou repetidos', () => {
    const e = aplicar(criado(), lance('ana', 100), T0 + 1000).estado;
    const prazo = '2026-11-23T13:01:00.000Z';
    const obsoleto = decidir(
      e,
      { tipo: 'EncerrarLeilao', leilaoId: 'L1', prazo: 'outro' },
      T0 + 60000,
    );
    expect(obsoleto.eventos).toEqual([]);
    const r = aplicar(
      e,
      { tipo: 'EncerrarLeilao', leilaoId: 'L1', prazo },
      T0 + 59999,
    );
    expect(r.eventos[0]).toMatchObject({
      tipo: 'LeilaoEncerrado',
      ocorridoEm: prazo,
      dados: { vencedor: 'ana', valor: 100 },
    });
    expect(r.estado.leiloes.get('L1')).toMatchObject({
      status: 'ENCERRADO',
      vencedor: 'ana',
    });
    expect(
      decidir(
        r.estado,
        { tipo: 'EncerrarLeilao', leilaoId: 'L1', prazo },
        T0 + 61000,
      ).eventos,
    ).toEqual([]);
  });

  it('encerra sem lances com vencedor nulo', () => {
    const r = aplicar(
      criado(),
      {
        tipo: 'EncerrarLeilao',
        leilaoId: 'L1',
        prazo: '2026-11-23T13:01:00.000Z',
      },
      T0 + 60000,
    );
    expect(r.eventos[0]).toMatchObject({
      dados: { vencedor: null, valor: null },
    });
  });
});
