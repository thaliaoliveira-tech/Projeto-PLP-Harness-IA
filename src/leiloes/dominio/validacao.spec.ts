import { describe, expect, it } from 'vitest';
import { validarNovoLance, validarNovoLeilao } from './validacao.js';

const ok = {
  titulo: 'Bike',
  lanceInicial: 100,
  incrementoMinimo: 10,
  duracaoSegundos: 60,
};

describe('validarNovoLeilao', () => {
  it('aceita corpo válido e assume prorrogação 0', () => {
    expect(validarNovoLeilao(ok)).toEqual({
      valido: true,
      valor: { ...ok, prorrogacaoSegundos: 0 },
    });
  });
  it.each([
    [null],
    ['x'],
    [[]],
    [{ ...ok, titulo: '   ' }],
    [{ ...ok, titulo: 1 }],
    [{ ...ok, lanceInicial: 0 }],
    [{ ...ok, lanceInicial: '1' }],
    [{ ...ok, incrementoMinimo: -1 }],
    [{ ...ok, duracaoSegundos: 0 }],
    [{ ...ok, duracaoSegundos: 86401 }],
    [{ ...ok, duracaoSegundos: 1.5 }],
    [{ ...ok, prorrogacaoSegundos: -1 }],
    [{ ...ok, prorrogacaoSegundos: 3601 }],
    [{ ...ok, prorrogacaoSegundos: 1.5 }],
    [{ ...ok, prorrogacaoSegundos: null }],
  ])('rejeita %j', (corpo) => {
    expect(validarNovoLeilao(corpo).valido).toBe(false);
  });
  it('aceita limites', () => {
    expect(
      validarNovoLeilao({
        ...ok,
        duracaoSegundos: 86400,
        prorrogacaoSegundos: 3600,
      }).valido,
    ).toBe(true);
    expect(validarNovoLeilao({ ...ok, lanceInicial: 0.5 }).valido).toBe(true);
  });
});

describe('validarNovoLance', () => {
  it('aceita corpo válido', () => {
    expect(validarNovoLance({ participante: 'ana', valor: 1 })).toEqual({
      valido: true,
      valor: { participante: 'ana', valor: 1 },
    });
  });
  it.each([
    [undefined],
    [{ participante: '', valor: 1 }],
    [{ participante: 'a', valor: 0 }],
    [{ participante: 'a', valor: '5' }],
    [{ participante: 1, valor: 5 }],
    [{ participante: 'a' }],
  ])('rejeita %j', (corpo) => {
    expect(validarNovoLance(corpo).valido).toBe(false);
  });
});
