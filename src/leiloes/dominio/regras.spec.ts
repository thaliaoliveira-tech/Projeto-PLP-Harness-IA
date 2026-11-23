import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, PROCESSAMENTO_INICIAL, decidir, processar, valorMinimo } from './regras.js';
import type { Comando, Estado, Processamento } from './tipos.js';

const T0 = Date.parse('2026-01-01T12:00:00.000Z');
const criar = (extra: Partial<Extract<Comando, { tipo: 'Criar' }>> = {}): Comando => ({
  tipo: 'Criar', leilaoId: 'L1', titulo: 'Bike', lanceInicial: 100, incrementoMinimo: 10,
  duracaoSegundos: 60, prorrogacaoSegundos: 0, ...extra,
});
const lance = (participante: string, valor: number): Comando => ({ tipo: 'Lance', leilaoId: 'L1', participante, valor });

function rodar(passos: Array<[Comando, number]>): Processamento {
  return passos.reduce<Processamento>(
    (ant, [comando, instante], i) => processar(ant.estado, { id: `e${i}`, comando, instante }),
    PROCESSAMENTO_INICIAL,
  );
}
const estadoCom = (passos: Array<[Comando, number]>): Estado => rodar(passos).estado;

describe('regras do leilão', () => {
  it('criação gera LeilaoCriado com encerraEm = instante + duração', () => {
    const p = rodar([[criar(), T0]]);
    expect(p.eventos[0]).toMatchObject({ sequencia: 1, tipo: 'LeilaoCriado' });
    expect(p.resultado).toMatchObject({ tipo: 'Ok', leilao: { status: 'ABERTO', encerraEm: '2026-01-01T12:01:00.000Z' } });
  });

  it('primeiro lance precisa ser >= lanceInicial', () => {
    const e = estadoCom([[criar(), T0]]);
    expect(decidir(e, lance('ana', 99), T0 + 1).resultado).toEqual({ tipo: 'Recusado', motivo: 'VALOR_ABAIXO_DO_MINIMO', valorMinimo: 100 });
    expect(decidir(e, lance('ana', 100), T0 + 1).eventos[0]?.tipo).toBe('LanceAceito');
  });

  it('exige maior lance + incremento e impede o líder de cobrir a si mesmo', () => {
    const e = estadoCom([[criar(), T0], [lance('ana', 100), T0 + 1]]);
    expect(valorMinimo(e.get('L1')!.leilao)).toBe(110);
    expect(decidir(e, lance('bia', 109), T0 + 2).resultado).toMatchObject({ motivo: 'VALOR_ABAIXO_DO_MINIMO' });
    expect(decidir(e, lance('ana', 500), T0 + 2).resultado).toEqual({ tipo: 'Recusado', motivo: 'PARTICIPANTE_JA_LIDERA' });
  });

  it('prorroga quando o lance cai na janela anti-sniping', () => {
    const e = estadoCom([[criar({ duracaoSegundos: 10, prorrogacaoSegundos: 5 }), T0]]);
    expect(decidir(e, lance('ana', 100), T0 + 7000).eventos.map((x) => x.tipo)).toEqual(['LanceAceito', 'LeilaoProrrogado']);
    expect(decidir(e, lance('ana', 100), T0 + 1000).eventos.map((x) => x.tipo)).toEqual(['LanceAceito']);
  });

  it('lance após o prazo encerra o leilão e é recusado', () => {
    const e = estadoCom([[criar({ duracaoSegundos: 1 }), T0], [lance('ana', 100), T0 + 10]]);
    const d = decidir(e, lance('bia', 200), T0 + 1000);
    expect(d.resultado).toEqual({ tipo: 'Recusado', motivo: 'LEILAO_ENCERRADO' });
    expect(d.eventos[0]).toMatchObject({ tipo: 'LeilaoEncerrado', dados: { vencedor: 'ana', valor: 100 } });
  });

  it('Encerrar só vale se o prazo agendado é o vigente', () => {
    const e = estadoCom([[criar({ duracaoSegundos: 1, prorrogacaoSegundos: 3 }), T0], [lance('ana', 100), T0 + 500]]);
    expect(decidir(e, { tipo: 'Encerrar', leilaoId: 'L1', prazo: '2026-01-01T12:00:01.000Z' }, T0 + 1000).eventos).toEqual([]);
    expect(decidir(e, { tipo: 'Encerrar', leilaoId: 'L1', prazo: '2026-01-01T12:00:03.500Z' }, T0 + 3499).eventos[0]?.tipo).toBe('LeilaoEncerrado');
  });

  it('leilão inexistente devolve NaoEncontrado', () => {
    expect(decidir(ESTADO_INICIAL, lance('ana', 100), T0).resultado).toEqual({ tipo: 'NaoEncontrado' });
  });
});
