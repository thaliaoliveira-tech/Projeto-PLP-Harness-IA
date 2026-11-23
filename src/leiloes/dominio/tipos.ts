export type StatusLeilao = 'ABERTO' | 'ENCERRADO';

export interface Lance {
  participante: string;
  valor: number;
  ocorridoEm: string;
}

/** Recurso devolvido pela API. */
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

/** Leilão no estado interno: o recurso mais a última sequência de evento emitida. */
export interface LeilaoEstado extends Leilao {
  sequencia: number;
}

export interface EstadoLeiloes {
  leiloes: Readonly<Record<string, LeilaoEstado>>;
}

export type MotivoRejeicao =
  'PARTICIPANTE_JA_LIDERA' | 'VALOR_ABAIXO_DO_MINIMO';

interface Base {
  sequencia: number;
  leilaoId: string;
  ocorridoEm: string;
}

export interface LeilaoCriado extends Base {
  tipo: 'LeilaoCriado';
  dados: {
    titulo: string;
    lanceInicial: number;
    incrementoMinimo: number;
    prorrogacaoSegundos: number;
    encerraEm: string;
  };
}

export interface LanceAceito extends Base {
  tipo: 'LanceAceito';
  dados: { participante: string; valor: number };
}

export interface LanceRejeitado extends Base {
  tipo: 'LanceRejeitado';
  dados: { participante: string; valor: number; motivo: MotivoRejeicao };
}

export interface LeilaoProrrogado extends Base {
  tipo: 'LeilaoProrrogado';
  dados: { encerraEmAnterior: string; encerraEm: string };
}

export interface LeilaoEncerrado extends Base {
  tipo: 'LeilaoEncerrado';
  dados: { vencedor: string | null; valor: number | null };
}

export type EventoLeilao =
  | LeilaoCriado
  | LanceAceito
  | LanceRejeitado
  | LeilaoProrrogado
  | LeilaoEncerrado;

export interface CriarLeilao {
  tipo: 'CriarLeilao';
  id: string;
  titulo: string;
  lanceInicial: number;
  incrementoMinimo: number;
  duracaoSegundos: number;
  prorrogacaoSegundos: number;
}

export interface DarLance {
  tipo: 'DarLance';
  leilaoId: string;
  participante: string;
  valor: number;
}

/** `prazo` é o `encerraEm` para o qual o temporizador foi agendado; se mudou (prorrogação), o comando é ignorado. */
export interface EncerrarLeilao {
  tipo: 'EncerrarLeilao';
  leilaoId: string;
  prazo: string;
}

export type ComandoLeilao = CriarLeilao | DarLance | EncerrarLeilao;

export type RespostaComando =
  | { tipo: 'CRIADO'; leilaoId: string }
  | { tipo: 'LANCE_ACEITO'; leilaoId: string }
  | { tipo: 'LANCE_RECUSADO'; motivo: MotivoRejeicao; valorMinimo?: number }
  | { tipo: 'LEILAO_ENCERRADO' }
  | { tipo: 'NAO_ENCONTRADO' }
  | { tipo: 'OK' };

export interface Decisao {
  eventos: EventoLeilao[];
  resposta: RespostaComando;
}

export interface Processamento extends Decisao {
  estado: EstadoLeiloes;
}
