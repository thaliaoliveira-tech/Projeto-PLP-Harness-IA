// Tipos do domínio de leilões. Este arquivo não depende de NestJS nem de RxJS.

export type StatusLeilao = 'ABERTO' | 'ENCERRADO';

export type MotivoRecusa =
  | 'LEILAO_ENCERRADO'
  | 'PARTICIPANTE_JA_LIDERA'
  | 'VALOR_ABAIXO_DO_MINIMO';

export interface Lance {
  readonly participante: string;
  readonly valor: number;
  readonly ocorridoEm: string;
}

/** Representação pública de um leilão (formato devolvido pela API). */
export interface Leilao {
  readonly id: string;
  readonly titulo: string;
  readonly lanceInicial: number;
  readonly incrementoMinimo: number;
  readonly prorrogacaoSegundos: number;
  readonly status: StatusLeilao;
  readonly maiorLance: Lance | null;
  readonly totalLances: number;
  readonly encerraEm: string;
  readonly vencedor: string | null;
}

// ---------------------------------------------------------------- eventos

interface EventoBase<T extends string, D> {
  readonly sequencia: number;
  readonly tipo: T;
  readonly leilaoId: string;
  readonly ocorridoEm: string;
  readonly dados: D;
}

export type LeilaoCriado = EventoBase<
  'LeilaoCriado',
  {
    readonly titulo: string;
    readonly lanceInicial: number;
    readonly incrementoMinimo: number;
    readonly prorrogacaoSegundos: number;
    readonly encerraEm: string;
  }
>;
export type LanceAceito = EventoBase<
  'LanceAceito',
  { readonly participante: string; readonly valor: number }
>;
export type LanceRejeitado = EventoBase<
  'LanceRejeitado',
  {
    readonly participante: string;
    readonly valor: number;
    readonly motivo: MotivoRecusa;
  }
>;
export type LeilaoProrrogado = EventoBase<
  'LeilaoProrrogado',
  { readonly encerraEmAnterior: string; readonly encerraEm: string }
>;
export type LeilaoEncerrado = EventoBase<
  'LeilaoEncerrado',
  { readonly vencedor: string | null; readonly valor: number | null }
>;

export type EventoLeilao =
  | LeilaoCriado
  | LanceAceito
  | LanceRejeitado
  | LeilaoProrrogado
  | LeilaoEncerrado;

// ---------------------------------------------------------------- comandos

export interface CriarLeilao {
  readonly tipo: 'CriarLeilao';
  readonly leilaoId: string;
  readonly titulo: string;
  readonly lanceInicial: number;
  readonly incrementoMinimo: number;
  readonly duracaoSegundos: number;
  readonly prorrogacaoSegundos: number;
}

export interface DarLance {
  readonly tipo: 'DarLance';
  readonly leilaoId: string;
  readonly participante: string;
  readonly valor: number;
}

export interface EncerrarLeilao {
  readonly tipo: 'EncerrarLeilao';
  readonly leilaoId: string;
}

export type Comando = CriarLeilao | DarLance | EncerrarLeilao;

/** Comando carimbado com identificador e instante de chegada (em ms). */
export interface Entrada {
  readonly id: string;
  readonly comando: Comando;
  readonly instante: number;
}

// ---------------------------------------------------------------- resultados

export type Resultado =
  | { readonly tipo: 'Criado'; readonly leilao: Leilao }
  | { readonly tipo: 'LanceAceito'; readonly leilao: Leilao }
  | {
      readonly tipo: 'LanceRecusado';
      readonly motivo: MotivoRecusa;
      readonly valorMinimo?: number;
    }
  | { readonly tipo: 'NaoEncontrado' }
  | { readonly tipo: 'SemEfeito' };

// ---------------------------------------------------------------- estado

export interface EstadoLeilao {
  readonly leilao: Leilao;
  readonly eventos: readonly EventoLeilao[];
}

export interface Estado {
  readonly leiloes: ReadonlyMap<string, EstadoLeilao>;
}

export interface Processamento {
  readonly entradaId: string | null;
  readonly estado: Estado;
  readonly eventos: readonly EventoLeilao[];
  readonly resultado: Resultado;
}
