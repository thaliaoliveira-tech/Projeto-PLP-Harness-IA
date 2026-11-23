// ANTI-GABARITO: estado imperativo em Map, alimentado por chamadas diretas do LeiloesService.
import { Injectable } from '@nestjs/common';

export type Notificacao = Record<string, unknown> & { tipo: string };

@Injectable()
export class NotificacoesService {
  private porParticipante = new Map<string, Notificacao[]>();

  adicionar(participante: string, notificacao: Notificacao): void {
    const lista = this.porParticipante.get(participante) ?? [];
    lista.push(notificacao);
    this.porParticipante.set(participante, lista);
  }

  listar(participante: string): Notificacao[] {
    return this.porParticipante.get(participante) ?? [];
  }
}
