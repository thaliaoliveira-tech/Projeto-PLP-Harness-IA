import type { NovoLance, NovoLeilao } from './tipos.js';

export type Validacao<T> = { valido: true; valor: T } | { valido: false };

const ehObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const ehNumero = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x);
const ehInteiroEntre = (x: unknown, min: number, max: number): x is number =>
  ehNumero(x) && Number.isInteger(x) && x >= min && x <= max;

export function validarNovoLeilao(corpo: unknown): Validacao<NovoLeilao> {
  if (!ehObjeto(corpo)) return { valido: false };
  const {
    titulo,
    lanceInicial,
    incrementoMinimo,
    duracaoSegundos,
    prorrogacaoSegundos = 0,
  } = corpo;
  if (typeof titulo !== 'string' || titulo.trim() === '')
    return { valido: false };
  if (!ehNumero(lanceInicial) || lanceInicial <= 0) return { valido: false };
  if (!ehNumero(incrementoMinimo) || incrementoMinimo <= 0)
    return { valido: false };
  if (!ehInteiroEntre(duracaoSegundos, 1, 86400)) return { valido: false };
  if (!ehInteiroEntre(prorrogacaoSegundos, 0, 3600)) return { valido: false };
  return {
    valido: true,
    valor: {
      titulo,
      lanceInicial,
      incrementoMinimo,
      duracaoSegundos,
      prorrogacaoSegundos,
    },
  };
}

export function validarNovoLance(corpo: unknown): Validacao<NovoLance> {
  if (!ehObjeto(corpo)) return { valido: false };
  const { participante, valor } = corpo;
  if (typeof participante !== 'string' || participante === '')
    return { valido: false };
  if (!ehNumero(valor) || valor <= 0) return { valido: false };
  return { valido: true, valor: { participante, valor } };
}
