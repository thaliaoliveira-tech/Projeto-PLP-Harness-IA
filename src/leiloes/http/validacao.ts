export interface NovoLeilao {
  titulo: string;
  lanceInicial: number;
  incrementoMinimo: number;
  duracaoSegundos: number;
  prorrogacaoSegundos: number;
}

export interface NovoLance {
  participante: string;
  valor: number;
}

type Validacao<T> = { ok: true; valor: T } | { ok: false; erro: string };

const objeto = (c: unknown): c is Record<string, unknown> => typeof c === 'object' && c !== null && !Array.isArray(c);
const numeroPositivo = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const inteiroEntre = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const textoNaoVazio = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function validarNovoLeilao(corpo: unknown): Validacao<NovoLeilao> {
  if (!objeto(corpo)) return { ok: false, erro: 'corpo deve ser um objeto JSON' };
  const { titulo, lanceInicial, incrementoMinimo, duracaoSegundos, prorrogacaoSegundos = 0 } = corpo;
  if (!textoNaoVazio(titulo)) return { ok: false, erro: 'titulo deve ser uma string não vazia' };
  if (!numeroPositivo(lanceInicial)) return { ok: false, erro: 'lanceInicial deve ser um número maior que zero' };
  if (!numeroPositivo(incrementoMinimo)) return { ok: false, erro: 'incrementoMinimo deve ser um número maior que zero' };
  if (!inteiroEntre(duracaoSegundos, 1, 86400)) return { ok: false, erro: 'duracaoSegundos deve ser um inteiro de 1 a 86400' };
  if (!inteiroEntre(prorrogacaoSegundos, 0, 3600)) {
    return { ok: false, erro: 'prorrogacaoSegundos deve ser um inteiro de 0 a 3600' };
  }
  return { ok: true, valor: { titulo, lanceInicial, incrementoMinimo, duracaoSegundos, prorrogacaoSegundos } };
}

export function validarNovoLance(corpo: unknown): Validacao<NovoLance> {
  if (!objeto(corpo)) return { ok: false, erro: 'corpo deve ser um objeto JSON' };
  const { participante, valor } = corpo;
  if (!textoNaoVazio(participante)) return { ok: false, erro: 'participante deve ser uma string não vazia' };
  if (!numeroPositivo(valor)) return { ok: false, erro: 'valor deve ser um número maior que zero' };
  return { ok: true, valor: { participante, valor } };
}
