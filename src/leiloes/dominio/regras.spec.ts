import { describe, expect, it } from 'vitest';
import {
  decidir,
  ESTADO_INICIAL,
  evoluir,
  paraLeilao,
  processar,
  registrar,
  valorMinimo,
} from './regras.js';
import type { ComandoLeilao, EstadoLeiloes } from './tipos.js';

const T0 = Date.parse('2026-11-23T13:00:00.000Z');
const criar = (
  extra: Partial<Extract<ComandoLeilao, { tipo: 'CriarLeilao' }>> = {},
): ComandoLeilao => ({
  tipo: 'CriarLeilao',
  id: 'a',
  titulo: 'Bike',
  lanceInicial: 100,
  incrementoMinimo: 10,
  duracaoSegundos: 60,
  prorrogacaoSegundos: 5,
  ...extra,
});
const lance = (participante: string, valor: number): ComandoLeilao => ({
  tipo: 'DarLance',
  leilaoId: 'a',
  participante,
  valor,
});

const passo = (estado: EstadoLeiloes, comando: ComandoLeilao, agora: number) =>
  processar(estado, comando, agora);
const aberto = (extra = {}) => passo(ESTADO_INICIAL, criar(extra), T0).estado;

describe('decidir', () => {
  it('cria o leilão com encerraEm = agora + duração', () => {
    const r = decidir(ESTADO_INICIAL, criar(), T0);
    expect(r.eventos).toEqual([
      expect.objectContaining({
        sequencia: 1,
        tipo: 'LeilaoCriado',
        dados: expect.objectContaining({
          encerraEm: '2026-11-23T13:01:00.000Z',
        }),
      }),
    ]);
  });

  it('leilão inexistente', () => {
    expect(decidir(ESTADO_INICIAL, lance('ana', 100), T0).resposta).toEqual({
      tipo: 'NAO_ENCONTRADO',
    });
  });

  it('aceita lance igual ao inicial e igual ao mínimo', () => {
    const e1 = passo(aberto(), lance('ana', 100), T0 + 1000);
    expect(e1.resposta.tipo).toBe('LANCE_ACEITO');
    const e2 = passo(e1.estado, lance('bia', 110), T0 + 2000);
    expect(e2.resposta.tipo).toBe('LANCE_ACEITO');
    expect(e2.estado.leiloes.a!.totalLances).toBe(2);
  });

  it('rejeita abaixo do mínimo informando valorMinimo', () => {
    expect(decidir(aberto(), lance('ana', 99), T0).resposta).toEqual({
      tipo: 'LANCE_RECUSADO',
      motivo: 'VALOR_ABAIXO_DO_MINIMO',
      valorMinimo: 100,
    });
  });

  it('rejeita quem já lidera (antes de checar o valor)', () => {
    const { estado } = passo(aberto(), lance('ana', 100), T0);
    const r = decidir(estado, lance('ana', 1), T0);
    expect(r.resposta).toEqual({
      tipo: 'LANCE_RECUSADO',
      motivo: 'PARTICIPANTE_JA_LIDERA',
    });
    expect(r.eventos[0]).toMatchObject({
      tipo: 'LanceRejeitado',
      sequencia: 3,
    });
  });

  it('lance no instante de encerraEm é recusado sem evento', () => {
    const r = decidir(aberto(), lance('ana', 100), T0 + 60_000);
    expect(r).toEqual({ eventos: [], resposta: { tipo: 'LEILAO_ENCERRADO' } });
  });

  it('prorroga só quando falta menos que a janela', () => {
    expect(
      decidir(aberto(), lance('ana', 100), T0 + 55_000).eventos.map(
        (e) => e.tipo,
      ),
    ).toEqual(['LanceAceito']);
    const r = decidir(aberto(), lance('ana', 100), T0 + 56_000);
    expect(r.eventos.map((e) => e.tipo)).toEqual([
      'LanceAceito',
      'LeilaoProrrogado',
    ]);
    expect(r.eventos[1]).toMatchObject({
      sequencia: 3,
      dados: {
        encerraEmAnterior: '2026-11-23T13:01:00.000Z',
        encerraEm: '2026-11-23T13:01:01.000Z',
      },
    });
  });

  it('prorrogação 0 nunca prorroga', () => {
    const r = decidir(
      aberto({ prorrogacaoSegundos: 0 }),
      lance('ana', 100),
      T0 + 59_999,
    );
    expect(r.eventos.map((e) => e.tipo)).toEqual(['LanceAceito']);
  });

  it('encerra com vencedor, mesmo se o timer disparar um pouco antes', () => {
    const { estado } = passo(aberto(), lance('ana', 100), T0);
    const r = processar(
      estado,
      {
        tipo: 'EncerrarLeilao',
        leilaoId: 'a',
        prazo: '2026-11-23T13:01:00.000Z',
      },
      T0 + 59_999,
    );
    expect(r.eventos[0]).toMatchObject({
      tipo: 'LeilaoEncerrado',
      ocorridoEm: '2026-11-23T13:01:00.000Z',
      dados: { vencedor: 'ana', valor: 100 },
    });
    expect(r.estado.leiloes.a).toMatchObject({
      status: 'ENCERRADO',
      vencedor: 'ana',
    });
  });

  it('ignora encerramento de prazo antigo ou leilão já encerrado', () => {
    const { estado } = passo(aberto(), lance('ana', 100), T0 + 58_000);
    const antigo = {
      tipo: 'EncerrarLeilao',
      leilaoId: 'a',
      prazo: '2026-11-23T13:01:00.000Z',
    } as const;
    expect(decidir(estado, antigo, T0 + 60_000).eventos).toEqual([]);
    const fim = passo(
      estado,
      { ...antigo, prazo: estado.leiloes.a!.encerraEm },
      T0 + 63_000,
    );
    expect(fim.eventos).toHaveLength(1);
    expect(
      decidir(
        fim.estado,
        { ...antigo, prazo: estado.leiloes.a!.encerraEm },
        T0 + 64_000,
      ).eventos,
    ).toEqual([]);
  });

  it('encerra sem lances com vencedor null', () => {
    const r = decidir(
      aberto(),
      {
        tipo: 'EncerrarLeilao',
        leilaoId: 'a',
        prazo: '2026-11-23T13:01:00.000Z',
      },
      T0 + 60_000,
    );
    expect(r.eventos[0]).toMatchObject({
      dados: { vencedor: null, valor: null },
    });
  });
});

describe('evoluir / projeções', () => {
  it('não altera o estado recebido', () => {
    const antes = aberto();
    const copia = structuredClone(antes);
    passo(antes, lance('ana', 100), T0);
    expect(antes).toEqual(copia);
  });

  it('paraLeilao remove a sequência e valorMinimo segue o último lance', () => {
    const { estado } = passo(aberto(), lance('ana', 100), T0 + 1000);
    const leilao = paraLeilao(estado.leiloes.a!);
    expect(leilao).not.toHaveProperty('sequencia');
    expect(leilao.maiorLance).toEqual({
      participante: 'ana',
      valor: 100,
      ocorridoEm: '2026-11-23T13:00:01.000Z',
    });
    expect(valorMinimo(leilao)).toBe(110);
  });

  it('registrar acumula eventos por leilão sem mutar', () => {
    const [criado] = decidir(ESTADO_INICIAL, criar(), T0).eventos;
    const h1 = registrar({}, criado!);
    const h2 = registrar(h1, { ...criado!, sequencia: 2 });
    expect(h1.a).toHaveLength(1);
    expect(h2.a).toHaveLength(2);
    expect(evoluir(ESTADO_INICIAL, criado!).leiloes.a!.sequencia).toBe(1);
  });
});
