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

/** Leilão como mantido internamente: o público mais o contador de sequência dos eventos. */
export interface LeilaoEstado extends Leilao {
  ultimaSequencia: number;
}

export interface EstadoLeiloes {
  leiloes: ReadonlyMap<string, LeilaoEstado>;
}

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

export type MotivoRecusa =
  'LEILAO_ENCERRADO' | 'PARTICIPANTE_JA_LIDERA' | 'VALOR_ABAIXO_DO_MINIMO';

export type Comando =
  | { tipo: 'CriarLeilao'; id: string; dados: NovoLeilao }
  | { tipo: 'DarLance'; leilaoId: string; dados: NovoLance }
  /** `prazo` é o `encerraEm` para o qual o temporizador foi agendado. */
  | { tipo: 'EncerrarLeilao'; leilaoId: string; prazo: string };

interface EventoBase<T extends string, D> {
  sequencia: number;
  tipo: T;
  leilaoId: string;
  ocorridoEm: string;
  dados: D;
}

export type EventoLeilao =
  | EventoBase<
      'LeilaoCriado',
      {
        titulo: string;
        lanceInicial: number;
        incrementoMinimo: number;
        prorrogacaoSegundos: number;
        encerraEm: string;
      }
    >
  | EventoBase<'LanceAceito', { participante: string; valor: number }>
  | EventoBase<
      'LanceRejeitado',
      { participante: string; valor: number; motivo: MotivoRecusa }
    >
  | EventoBase<
      'LeilaoProrrogado',
      { encerraEmAnterior: string; encerraEm: string }
    >
  | EventoBase<
      'LeilaoEncerrado',
      { vencedor: string | null; valor: number | null }
    >;

export type Resultado =
  | { tipo: 'LEILAO_CRIADO'; leilaoId: string }
  | { tipo: 'LANCE_ACEITO'; leilaoId: string }
  | { tipo: 'LANCE_RECUSADO'; motivo: MotivoRecusa; valorMinimo?: number }
  | { tipo: 'LEILAO_INEXISTENTE' }
  | { tipo: 'IGNORADO' };

export interface Decisao {
  eventos: EventoLeilao[];
  resultado: Resultado;
}
