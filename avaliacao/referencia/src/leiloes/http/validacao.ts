// Validação pura dos corpos das requisições (sem NestJS).

export type Validado<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly erros: readonly string[] };

export interface DadosCriacao {
  readonly titulo: string;
  readonly lanceInicial: number;
  readonly incrementoMinimo: number;
  readonly duracaoSegundos: number;
  readonly prorrogacaoSegundos: number;
}

export interface DadosLance {
  readonly participante: string;
  readonly valor: number;
}

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const ehNumeroPositivo = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

const ehInteiroEntre = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

const ehTextoPreenchido = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

export function validarCriacao(corpo: unknown): Validado<DadosCriacao> {
  if (!ehObjeto(corpo)) return { ok: false, erros: ['corpo deve ser um objeto JSON'] };
  const { titulo, lanceInicial, incrementoMinimo, duracaoSegundos } = corpo;
  const prorrogacaoSegundos = corpo.prorrogacaoSegundos ?? 0;
  const erros = [
    ehTextoPreenchido(titulo) ? null : 'titulo deve ser texto não vazio',
    ehNumeroPositivo(lanceInicial) ? null : 'lanceInicial deve ser número > 0',
    ehNumeroPositivo(incrementoMinimo) ? null : 'incrementoMinimo deve ser número > 0',
    ehInteiroEntre(duracaoSegundos, 1, 86400)
      ? null
      : 'duracaoSegundos deve ser inteiro entre 1 e 86400',
    ehInteiroEntre(prorrogacaoSegundos, 0, 3600)
      ? null
      : 'prorrogacaoSegundos deve ser inteiro entre 0 e 3600',
  ].filter((e): e is string => e !== null);
  if (erros.length > 0) return { ok: false, erros };
  return {
    ok: true,
    valor: {
      titulo: (titulo as string).trim(),
      lanceInicial: lanceInicial as number,
      incrementoMinimo: incrementoMinimo as number,
      duracaoSegundos: duracaoSegundos as number,
      prorrogacaoSegundos: prorrogacaoSegundos as number,
    },
  };
}

export function validarLance(corpo: unknown): Validado<DadosLance> {
  if (!ehObjeto(corpo)) return { ok: false, erros: ['corpo deve ser um objeto JSON'] };
  const { participante, valor } = corpo;
  const erros = [
    ehTextoPreenchido(participante) ? null : 'participante deve ser texto não vazio',
    ehNumeroPositivo(valor) ? null : 'valor deve ser número > 0',
  ].filter((e): e is string => e !== null);
  if (erros.length > 0) return { ok: false, erros };
  return {
    ok: true,
    valor: { participante: participante as string, valor: valor as number },
  };
}
