import type { CriarLeilao } from '../dominio/tipos.js';

type Resultado<T> = { valido: true; valor: T } | { valido: false };

const registro = (v: unknown): Record<string, unknown> | undefined =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;

const textoNaoVazio = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;
const positivo = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;
const inteiroEntre = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

export function validarCriacao(
  corpo: unknown,
): Resultado<Omit<CriarLeilao, 'tipo' | 'id'>> {
  const c = registro(corpo);
  if (
    !c ||
    !textoNaoVazio(c.titulo) ||
    !positivo(c.lanceInicial) ||
    !positivo(c.incrementoMinimo) ||
    !inteiroEntre(c.duracaoSegundos, 1, 86400)
  ) {
    return { valido: false };
  }
  const prorrogacao = c.prorrogacaoSegundos ?? 0;
  if (!inteiroEntre(prorrogacao, 0, 3600)) return { valido: false };
  return {
    valido: true,
    valor: {
      titulo: c.titulo,
      lanceInicial: c.lanceInicial,
      incrementoMinimo: c.incrementoMinimo,
      duracaoSegundos: c.duracaoSegundos,
      prorrogacaoSegundos: prorrogacao,
    },
  };
}

export function validarLance(
  corpo: unknown,
): Resultado<{ participante: string; valor: number }> {
  const c = registro(corpo);
  if (!c || !textoNaoVazio(c.participante) || !positivo(c.valor))
    return { valido: false };
  return {
    valido: true,
    valor: { participante: c.participante, valor: c.valor },
  };
}
