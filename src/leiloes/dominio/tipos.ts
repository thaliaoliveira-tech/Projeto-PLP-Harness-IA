export type StatusLeilao = 'ABERTO' | 'ENCERRADO';

export interface Lance {
  participante: string;
  valor: number;
  ocorridoEm: string;
}

/** Formato público do recurso Leilao. */
export interface Leilao {
  id: string;
  titulo: string;
  lanceInicial: number;
  incrementoMinimo: number;
  prorrogacaoSegundos: number;
  status: StatusLeilao;
  maiorLance: Lance | null;
  totalLances: number;
  encerraEm: string;
  vencedor: string | null;
}

/** Estado interno de um leilão: o recurso público + a última sequência de evento emitida. */
export interface EstadoLeilao extends Leilao {
  sequencia: number;
}

interface EventoBase<T extends string, D> {
  sequencia: number;
  tipo: T;
  leilaoId: string;
  ocorridoEm: string;
  dados: D;
}

export type MotivoRejeicao = 'PARTICIPANTE_JA_LIDERA' | 'VALOR_ABAIXO_DO_MINIMO';

export type Evento =
  | EventoBase<
      'LeilaoCriado',
      { titulo: string; lanceInicial: number; incrementoMinimo: number; prorrogacaoSegundos: number; encerraEm: string }
    >
  | EventoBase<'LanceAceito', { participante: string; valor: number }>
  | EventoBase<'LanceRejeitado', { participante: string; valor: number; motivo: MotivoRejeicao }>
  | EventoBase<'LeilaoProrrogado', { encerraEmAnterior: string; encerraEm: string }>
  | EventoBase<'LeilaoEncerrado', { vencedor: string | null; valor: number | null }>;

export type Comando =
  | {
      tipo: 'CriarLeilao';
      leilaoId: string;
      titulo: string;
      lanceInicial: number;
      incrementoMinimo: number;
      duracaoSegundos: number;
      prorrogacaoSegundos: number;
    }
  | { tipo: 'DarLance'; leilaoId: string; participante: string; valor: number }
  /** `prazo` é o `encerraEm` para o qual o temporizador foi agendado. */
  | { tipo: 'EncerrarLeilao'; leilaoId: string; prazo: string };

export type Resultado =
  | { tipo: 'CRIADO'; leilao: Leilao }
  | { tipo: 'ACEITO'; leilao: Leilao }
  | { tipo: 'REJEITADO'; motivo: 'LEILAO_ENCERRADO' }
  | { tipo: 'REJEITADO'; motivo: 'PARTICIPANTE_JA_LIDERA' }
  | { tipo: 'REJEITADO'; motivo: 'VALOR_ABAIXO_DO_MINIMO'; valorMinimo: number }
  | { tipo: 'ENCERRADO'; leilao: Leilao }
  | { tipo: 'NAO_ENCONTRADO' }
  | { tipo: 'IGNORADO' };

export interface Decisao {
  eventos: Evento[];
  resultado: Resultado;
}
