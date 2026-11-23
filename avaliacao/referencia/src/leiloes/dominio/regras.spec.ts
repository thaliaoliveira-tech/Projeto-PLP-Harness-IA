import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, PROCESSAMENTO_INICIAL, decidir, evoluir, processar, valorMinimo } from './regras.js';
import type { Comando, Entrada, Estado, Processamento } from './tipos.js';

const T0 = Date.parse('2026-01-01T12:00:00.000Z');

const criar = (extra: Partial<Extract<Comando, { tipo: 'CriarLeilao' }>> = {}): Comando => ({
  tipo: 'CriarLeilao',
  leilaoId: 'L1',
  titulo: 'Bike',
  lanceInicial: 100,
  incrementoMinimo: 10,
  duracaoSegundos: 60,
  prorrogacaoSegundos: 0,
  ...extra,
});
const lance = (participante: string, valor: number): Comando => ({ tipo: 'DarLance', leilaoId: 'L1', participante, valor });

/** Aplica uma sequência de [comando, instante] e devolve o último processamento. */
function executar(passos: Array<[Comando, number]>): Processamento {
  return passos.reduce<Processamento>(
    (anterior, [comando, instante], i) => processar(anterior.estado, { id: `e${i}`, comando, instante } as Entrada),
    PROCESSAMENTO_INICIAL,
  );
}

const estadoCom = (passos: Array<[Comando, number]>): Estado => executar(passos).estado;

describe('decidir/processar', () => {
  it('criação gera LeilaoCriado com sequencia 1 e encerraEm = instante + duração', () => {
    const p = executar([[criar(), T0]]);
    expect(p.eventos).toHaveLength(1);
    expect(p.eventos[0]).toMatchObject({ sequencia: 1, tipo: 'LeilaoCriado', leilaoId: 'L1' });
    expect(p.resultado).toMatchObject({ tipo: 'Criado', leilao: { status: 'ABERTO', encerraEm: '2026-01-01T12:01:00.000Z' } });
  });

  it('primeiro lance precisa ser >= lanceInicial', () => {
    const estado = estadoCom([[criar(), T0]]);
    expect(decidir(estado, lance('ana', 99), T0 + 1).resultado).toEqual({
      tipo: 'LanceRecusado',
      motivo: 'VALOR_ABAIXO_DO_MINIMO',
      valorMinimo: 100,
    });
    expect(decidir(estado, lance('ana', 100), T0 + 1).eventos[0]).toMatchObject({ tipo: 'LanceAceito' });
  });

  it('lances seguintes precisam de maiorLance + incremento; o líder não pode cobrir a si mesmo', () => {
    const estado = estadoCom([
      [criar(), T0],
      [lance('ana', 100), T0 + 1],
    ]);
    expect(valorMinimo(estado.leiloes.get('L1')!.leilao)).toBe(110);
    expect(decidir(estado, lance('bia', 109), T0 + 2).eventos[0]).toMatchObject({
      tipo: 'LanceRejeitado',
      sequencia: 3,
      dados: { motivo: 'VALOR_ABAIXO_DO_MINIMO' },
    });
    expect(decidir(estado, lance('ana', 500), T0 + 2).resultado).toEqual({
      tipo: 'LanceRecusado',
      motivo: 'PARTICIPANTE_JA_LIDERA',
    });
  });

  it('prorroga quando o lance aceito cai na janela anti-sniping', () => {
    const estado = estadoCom([[criar({ duracaoSegundos: 10, prorrogacaoSegundos: 5 }), T0]]);
    const dentro = decidir(estado, lance('ana', 100), T0 + 7000);
    expect(dentro.eventos.map((e) => e.tipo)).toEqual(['LanceAceito', 'LeilaoProrrogado']);
    expect(dentro.eventos[1]).toMatchObject({
      dados: { encerraEmAnterior: '2026-01-01T12:00:10.000Z', encerraEm: '2026-01-01T12:00:12.000Z' },
    });
    const fora = decidir(estado, lance('ana', 100), T0 + 1000);
    expect(fora.eventos.map((e) => e.tipo)).toEqual(['LanceAceito']);
  });

  it('lance após o prazo encerra o leilão e é recusado com LEILAO_ENCERRADO', () => {
    const estado = estadoCom([
      [criar({ duracaoSegundos: 1 }), T0],
      [lance('ana', 100), T0 + 10],
    ]);
    const d = decidir(estado, lance('bia', 200), T0 + 1000);
    expect(d.resultado).toEqual({ tipo: 'LanceRecusado', motivo: 'LEILAO_ENCERRADO' });
    expect(d.eventos).toEqual([
      expect.objectContaining({ tipo: 'LeilaoEncerrado', dados: { vencedor: 'ana', valor: 100 } }),
    ]);
  });

  it('EncerrarLeilao só tem efeito se o prazo agendado ainda for o vigente', () => {
    const estado = estadoCom([
      [criar({ duracaoSegundos: 1, prorrogacaoSegundos: 3 }), T0],
      [lance('ana', 100), T0 + 500], // prorroga para T0 + 3500
    ]);
    const prazoOriginal = '2026-01-01T12:00:01.000Z';
    const prazoNovo = '2026-01-01T12:00:03.500Z';
    expect(decidir(estado, { tipo: 'EncerrarLeilao', leilaoId: 'L1', prazo: prazoOriginal }, T0 + 1000).eventos).toEqual([]);
    // o temporizador pode disparar ~1 ms antes de Date.now() alcançar o prazo: ainda assim encerra
    const d = decidir(estado, { tipo: 'EncerrarLeilao', leilaoId: 'L1', prazo: prazoNovo }, T0 + 3499);
    expect(d.eventos[0]).toMatchObject({ tipo: 'LeilaoEncerrado', ocorridoEm: prazoNovo });
  });

  it('comando para leilão inexistente devolve NaoEncontrado sem eventos', () => {
    expect(decidir(ESTADO_INICIAL, lance('ana', 100), T0)).toEqual({ eventos: [], resultado: { tipo: 'NaoEncontrado' } });
  });
});

describe('evoluir', () => {
  it('não altera o estado anterior (imutabilidade)', () => {
    const antes = estadoCom([[criar(), T0]]);
    const d = decidir(antes, lance('ana', 100), T0 + 1);
    const depois = d.eventos.reduce(evoluir, antes);
    expect(antes.leiloes.get('L1')!.leilao.totalLances).toBe(0);
    expect(depois.leiloes.get('L1')!.leilao.totalLances).toBe(1);
    expect(depois.leiloes.get('L1')!.eventos).toHaveLength(2);
  });
});
