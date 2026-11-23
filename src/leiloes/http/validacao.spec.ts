import { describe, expect, it } from 'vitest';
import { validarNovoLance, validarNovoLeilao } from './validacao.js';

const base = { titulo: 'Bike', lanceInicial: 100, incrementoMinimo: 10, duracaoSegundos: 60 };

describe('validarNovoLeilao', () => {
  it('aceita corpo válido e assume prorrogacaoSegundos = 0', () => {
    expect(validarNovoLeilao(base)).toEqual({ ok: true, valor: { ...base, prorrogacaoSegundos: 0 } });
  });
  it.each([
    [undefined],
    [{ ...base, titulo: '   ' }],
    [{ ...base, lanceInicial: 0 }],
    [{ ...base, incrementoMinimo: '10' }],
    [{ ...base, duracaoSegundos: 0 }],
    [{ ...base, duracaoSegundos: 86401 }],
    [{ ...base, duracaoSegundos: 1.5 }],
    [{ ...base, prorrogacaoSegundos: -1 }],
    [{ ...base, prorrogacaoSegundos: 3601 }],
    [{ ...base, prorrogacaoSegundos: null }],
  ])('rejeita %j', (corpo) => {
    expect(validarNovoLeilao(corpo).ok).toBe(false);
  });
});

describe('validarNovoLance', () => {
  it('aceita corpo válido', () => {
    expect(validarNovoLance({ participante: 'ana', valor: 1 }).ok).toBe(true);
  });
  it.each([[null], [{ participante: '', valor: 1 }], [{ participante: 'ana', valor: 0 }], [{ participante: 'ana', valor: '5' }]])(
    'rejeita %j',
    (corpo) => {
      expect(validarNovoLance(corpo).ok).toBe(false);
    },
  );
});
