export type Status = 'ABERTO' | 'ENCERRADO';

export interface Lance {
  participante: string;
  valor: number;
  ocorridoEm: string;
}

export interface Leilao {
  id: string;
  titulo: string;
  lanceInicial: number;
  incrementoMinimo: number;
  prorrogacaoSegundos: number;
  status: Status;
  maiorLance: Lance | null;
  totalLances: number;
  encerraEm: string;
  vencedor: string | null;
}

export type Motivo = 'LEILAO_ENCERRADO' | 'PARTICIPANTE_JA_LIDERA' | 'VALOR_ABAIXO_DO_MINIMO';

export interface Evento {
  sequencia: number;
  tipo: 'LeilaoCriado' | 'LanceAceito' | 'LanceRejeitado' | 'LeilaoProrrogado' | 'LeilaoEncerrado';
  leilaoId: string;
  ocorridoEm: string;
  dados: Record<string, unknown>;
}

export type Comando =
  | {
      tipo: 'Criar';
      leilaoId: string;
      titulo: string;
      lanceInicial: number;
      incrementoMinimo: number;
      duracaoSegundos: number;
      prorrogacaoSegundos: number;
    }
  | { tipo: 'Lance'; leilaoId: string; participante: string; valor: number }
  | { tipo: 'Encerrar'; leilaoId: string; prazo: string };

export interface Entrada {
  id: string;
  comando: Comando;
  instante: number;
}

export type Resultado =
  | { tipo: 'Ok'; leilao: Leilao }
  | { tipo: 'Recusado'; motivo: Motivo; valorMinimo?: number }
  | { tipo: 'NaoEncontrado' }
  | { tipo: 'Nada' };

export interface EstadoLeilao {
  leilao: Leilao;
  eventos: Evento[];
}

export type Estado = ReadonlyMap<string, EstadoLeilao>;

export interface Processamento {
  entradaId: string | null;
  estado: Estado;
  eventos: Evento[];
  resultado: Resultado;
}
