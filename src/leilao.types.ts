export type Lance = { participante: string; valor: number; ocorridoEm: string };

export interface Leilao {
  id: string;
  titulo: string;
  lanceInicial: number;
  incrementoMinimo: number;
  prorrogacaoSegundos: number;
  status: 'ABERTO' | 'ENCERRADO';
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

export type ResultadoLance =
  | { status: 201; corpo: { aceito: true; leilao: Leilao } }
  | { status: 404 }
  | { status: 400 }
  | { status: 409 | 422; corpo: Record<string, unknown> };
