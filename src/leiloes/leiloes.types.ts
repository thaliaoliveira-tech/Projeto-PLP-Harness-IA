export type StatusLeilao = 'ABERTO' | 'ENCERRADO';

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
  status: StatusLeilao;
  maiorLance: Lance | null;
  totalLances: number;
  encerraEm: string;
  vencedor: string | null;
}

export type TipoEvento =
  | 'LeilaoCriado'
  | 'LanceAceito'
  | 'LanceRejeitado'
  | 'LeilaoProrrogado'
  | 'LeilaoEncerrado';

export interface EventoLeilao {
  sequencia: number;
  tipo: TipoEvento;
  leilaoId: string;
  ocorridoEm: string;
  dados: Record<string, unknown>;
}

export type Notificacao =
  | {
      tipo: 'LANCE_SUPERADO';
      leilaoId: string;
      titulo: string;
      valorAnterior: number;
      novoValor: number;
      ocorridoEm: string;
    }
  | {
      tipo: 'LEILAO_VENCIDO';
      leilaoId: string;
      titulo: string;
      valor: number;
      ocorridoEm: string;
    };
