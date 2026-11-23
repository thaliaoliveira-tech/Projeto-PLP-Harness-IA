export type Notificacao =
  | {
      tipo: 'LANCE_SUPERADO';
      leilaoId: string;
      titulo: string;
      valorAnterior: number;
      novoValor: number;
      ocorridoEm: string;
    }
  | { tipo: 'LEILAO_VENCIDO'; leilaoId: string; titulo: string; valor: number; ocorridoEm: string };

export interface LiderDeLeilao {
  participante: string;
  valor: number;
}

export interface EstadoNotificacoes {
  titulos: ReadonlyMap<string, string>;
  lideres: ReadonlyMap<string, LiderDeLeilao>;
  porParticipante: ReadonlyMap<string, readonly Notificacao[]>;
}
