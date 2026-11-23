import { describe, expect, it } from 'vitest';
import { decidir, evoluir, paraLeilao, valorMinimo } from './regras.js';
import type { Comando, EstadoLeilao, Evento } from './tipos.js';

const T0 = Date.parse('2026-11-23T13:00:00.000Z');
const criar = (extra: Partial<Extract<Comando, { tipo: 'CriarLeilao' }>> = {}): Comando => ({
  tipo: 'CriarLeilao',
  leilaoId: 'L1',
  titulo: 'Bike',
  lanceInicial: 100,
  incrementoMinimo: 10,
  duracaoSegundos: 60,
  prorrogacaoSegundos: 5,
  ...extra,
});
const lance = (participante: string, valor: number): Comando => ({ tipo: 'DarLance', leilaoId: 'L1', participante, valor });

function aberto(extra = {}): EstadoLeilao {
  return decidir(undefined, criar(extra), T0).eventos.reduce<EstadoLeilao | undefined>(
    (e, ev) => evoluir(e, ev),
    undefined,
  ) as EstadoLeilao;
}
const aplicar = (e: EstadoLeilao, eventos: Evento[]) => eventos.reduce((s, ev) => evoluir(s, ev), e);

describe('decidir/CriarLeilao', () => {
  it('emite LeilaoCriado com encerraEm = agora + duração', () => {
    const d = decidir(undefined, criar(), T0);
    expect(d.eventos).toHaveLength(1);
    expect(d.eventos[0]).toMatchObject({ sequencia: 1, tipo: 'LeilaoCriado', dados: { encerraEm: '2026-11-23T13:01:00.000Z' } });
    expect(d.resultado).toMatchObject({ tipo: 'CRIADO', leilao: { status: 'ABERTO', maiorLance: null, vencedor: null } });
  });
});

describe('decidir/DarLance', () => {
  it('leilão inexistente', () => {
    expect(decidir(undefined, lance('ana', 100), T0).resultado).toEqual({ tipo: 'NAO_ENCONTRADO' });
  });

  it('aceita o lance igual ao mínimo (lanceInicial)', () => {
    const d = decidir(aberto(), lance('ana', 100), T0 + 1000);
    expect(d.eventos.map((e) => e.tipo)).toEqual(['LanceAceito']);
    expect(d.eventos[0]!.sequencia).toBe(2);
  });

  it('recusa abaixo do mínimo e informa valorMinimo', () => {
    const e = aplicar(aberto(), decidir(aberto(), lance('ana', 100), T0 + 1000).eventos);
    const d = decidir(e, lance('bia', 105), T0 + 2000);
    expect(d.resultado).toEqual({ tipo: 'REJEITADO', motivo: 'VALOR_ABAIXO_DO_MINIMO', valorMinimo: 110 });
    expect(d.eventos[0]).toMatchObject({ tipo: 'LanceRejeitado', sequencia: 3 });
    expect(valorMinimo(e)).toBe(110);
  });

  it('aceita o lance exatamente igual a maiorLance + incremento', () => {
    const e = aplicar(aberto(), decidir(aberto(), lance('ana', 100), T0 + 1000).eventos);
    expect(decidir(e, lance('bia', 110), T0 + 2000).resultado.tipo).toBe('ACEITO');
  });

  it('recusa quem já lidera, antes de checar o valor', () => {
    const e = aplicar(aberto(), decidir(aberto(), lance('ana', 100), T0 + 1000).eventos);
    expect(decidir(e, lance('ana', 5), T0 + 2000).resultado).toEqual({ tipo: 'REJEITADO', motivo: 'PARTICIPANTE_JA_LIDERA' });
  });

  it('recusa sem evento quando o instante >= encerraEm', () => {
    const d = decidir(aberto(), lance('ana', 100), T0 + 60_000);
    expect(d.eventos).toEqual([]);
    expect(d.resultado).toEqual({ tipo: 'REJEITADO', motivo: 'LEILAO_ENCERRADO' });
  });

  it('prorroga quando faltam menos de prorrogacaoSegundos', () => {
    const d = decidir(aberto(), lance('ana', 100), T0 + 56_000);
    expect(d.eventos.map((e) => e.tipo)).toEqual(['LanceAceito', 'LeilaoProrrogado']);
    expect(d.eventos[1]).toMatchObject({
      sequencia: 3,
      dados: { encerraEmAnterior: '2026-11-23T13:01:00.000Z', encerraEm: '2026-11-23T13:01:01.000Z' },
    });
    expect(d.resultado).toMatchObject({ leilao: { encerraEm: '2026-11-23T13:01:01.000Z' } });
  });

  it('não prorroga quando faltam exatamente prorrogacaoSegundos', () => {
    expect(decidir(aberto(), lance('ana', 100), T0 + 55_000).eventos).toHaveLength(1);
  });

  it('nunca prorroga com prorrogacaoSegundos = 0', () => {
    expect(decidir(aberto({ prorrogacaoSegundos: 0 }), lance('ana', 100), T0 + 59_999).eventos).toHaveLength(1);
  });
});

describe('decidir/EncerrarLeilao', () => {
  it('encerra com vencedor e define o valor', () => {
    const e = aplicar(aberto(), decidir(aberto(), lance('ana', 120), T0 + 1000).eventos);
    const d = decidir(e, { tipo: 'EncerrarLeilao', leilaoId: 'L1', prazo: e.encerraEm }, T0 + 60_000);
    expect(d.eventos[0]).toMatchObject({ tipo: 'LeilaoEncerrado', dados: { vencedor: 'ana', valor: 120 } });
    expect(paraLeilao(aplicar(e, d.eventos))).toMatchObject({ status: 'ENCERRADO', vencedor: 'ana' });
  });

  it('sem lances: vencedor e valor nulos; ocorridoEm nunca antes do prazo', () => {
    const e = aberto();
    const d = decidir(e, { tipo: 'EncerrarLeilao', leilaoId: 'L1', prazo: e.encerraEm }, T0 + 59_999);
    expect(d.eventos[0]).toMatchObject({ ocorridoEm: e.encerraEm, dados: { vencedor: null, valor: null } });
  });

  it('ignora prazo antigo (leilão prorrogado) e leilão já encerrado', () => {
    const e = aberto();
    expect(decidir(e, { tipo: 'EncerrarLeilao', leilaoId: 'L1', prazo: '2026-11-23T13:00:30.000Z' }, T0 + 60_000).resultado).toEqual({
      tipo: 'IGNORADO',
    });
    const fim = aplicar(e, decidir(e, { tipo: 'EncerrarLeilao', leilaoId: 'L1', prazo: e.encerraEm }, T0 + 60_000).eventos);
    expect(decidir(fim, { tipo: 'EncerrarLeilao', leilaoId: 'L1', prazo: e.encerraEm }, T0 + 61_000).eventos).toEqual([]);
  });
});
