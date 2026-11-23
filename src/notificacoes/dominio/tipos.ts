/** Visão mínima dos eventos de leilões que interessam às notificações (o domínio não importa outro módulo). */
export type EventoObservado =
  | {
      tipo: 'LeilaoCriado';
      leilaoId: string;
      ocorridoEm: string;
      dados: { titulo: string };
    }
  | {
      tipo: 'LanceAceito';
      leilaoId: string;
      ocorridoEm: string;
      dados: { participante: string; valor: number };
    }
  | {
      tipo: 'LeilaoEncerrado';
      leilaoId: string;
      ocorridoEm: string;
      dados: { vencedor: string | null; valor: number | null };
    }
  | {
      tipo: 'LanceRejeitado' | 'LeilaoProrrogado';
      leilaoId: string;
      ocorridoEm: string;
      dados: unknown;
    };

export interface LanceSuperado {
  tipo: 'LANCE_SUPERADO';
  leilaoId: string;
  titulo: string;
  valorAnterior: number;
  novoValor: number;
  ocorridoEm: string;
}

export interface LeilaoVencido {
  tipo: 'LEILAO_VENCIDO';
  leilaoId: string;
  titulo: string;
  valor: number;
  ocorridoEm: string;
}

export type Notificacao = LanceSuperado | LeilaoVencido;

export interface LeilaoObservado {
  titulo: string;
  lider: { participante: string; valor: number } | null;
}

export interface EstadoNotificacoes {
  leiloes: Readonly<Record<string, LeilaoObservado>>;
  porParticipante: Readonly<Record<string, readonly Notificacao[]>>;
}
