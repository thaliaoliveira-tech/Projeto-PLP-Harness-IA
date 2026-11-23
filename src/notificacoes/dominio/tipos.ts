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

export interface LiderAtual {
  participante: string;
  valor: number;
}

export interface EstadoNotificacoes {
  /** Título e líder atual de cada leilão, necessários para montar as notificações. */
  leiloes: ReadonlyMap<string, { titulo: string; lider: LiderAtual | null }>;
  porParticipante: ReadonlyMap<string, readonly Notificacao[]>;
}
