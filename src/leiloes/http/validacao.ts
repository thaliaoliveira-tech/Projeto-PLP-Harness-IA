export type Validado<T> = { ok: true; valor: T } | { ok: false; erros: string[] };

const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const positivo = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const inteiro = (v: unknown, a: number, b: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= a && v <= b;
const texto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function validarCriacao(c: unknown): Validado<{ titulo: string; lanceInicial: number; incrementoMinimo: number; duracaoSegundos: number; prorrogacaoSegundos: number }> {
  if (!obj(c)) return { ok: false, erros: ['corpo inválido'] };
  const prorrogacao = c['prorrogacaoSegundos'] ?? 0;
  const { titulo, lanceInicial, incrementoMinimo, duracaoSegundos } = c;
  if (!texto(titulo) || !positivo(lanceInicial) || !positivo(incrementoMinimo) || !inteiro(duracaoSegundos, 1, 86400) || !inteiro(prorrogacao, 0, 3600)) {
    return { ok: false, erros: ['dados de criação inválidos'] };
  }
  return { ok: true, valor: { titulo: titulo.trim(), lanceInicial, incrementoMinimo, duracaoSegundos, prorrogacaoSegundos: prorrogacao } };
}

export function validarLance(c: unknown): Validado<{ participante: string; valor: number }> {
  if (!obj(c)) return { ok: false, erros: ['corpo inválido'] };
  const { participante, valor } = c;
  if (!texto(participante) || !positivo(valor)) return { ok: false, erros: ['dados do lance inválidos'] };
  return { ok: true, valor: { participante, valor } };
}
