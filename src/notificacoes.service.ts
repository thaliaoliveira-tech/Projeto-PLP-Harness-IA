import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { LeilaoService } from './leilao.service.js';
import type { Notificacao } from './leilao.types.js';

/** Deriva notificações a partir do fluxo de eventos de todos os leilões. */
@Injectable()
export class NotificacoesService implements OnModuleDestroy {
  private readonly porParticipante = new Map<string, Notificacao[]>();
  private readonly titulos = new Map<string, string>();
  private readonly lideres = new Map<
    string,
    { participante: string; valor: number }
  >();

  private readonly inscricao;

  constructor(leiloes: LeilaoService) {
    this.inscricao = leiloes.todosEventos$.subscribe((ev) => {
      const titulo = this.titulos.get(ev.leilaoId) ?? '';
      switch (ev.tipo) {
        case 'LeilaoCriado':
          this.titulos.set(ev.leilaoId, ev.dados.titulo as string);
          break;
        case 'LanceAceito': {
          const participante = ev.dados.participante as string;
          const valor = ev.dados.valor as number;
          const anterior = this.lideres.get(ev.leilaoId);
          if (anterior && anterior.participante !== participante) {
            this.adicionar(anterior.participante, {
              tipo: 'LANCE_SUPERADO',
              leilaoId: ev.leilaoId,
              titulo,
              valorAnterior: anterior.valor,
              novoValor: valor,
              ocorridoEm: ev.ocorridoEm,
            });
          }
          this.lideres.set(ev.leilaoId, { participante, valor });
          break;
        }
        case 'LeilaoEncerrado':
          if (ev.dados.vencedor !== null) {
            this.adicionar(ev.dados.vencedor as string, {
              tipo: 'LEILAO_VENCIDO',
              leilaoId: ev.leilaoId,
              titulo,
              valor: ev.dados.valor as number,
              ocorridoEm: ev.ocorridoEm,
            });
          }
          break;
      }
    });
  }

  onModuleDestroy() {
    this.inscricao.unsubscribe();
  }

  private adicionar(nome: string, n: Notificacao) {
    const lista = this.porParticipante.get(nome) ?? [];
    lista.push(n);
    this.porParticipante.set(nome, lista);
  }

  listar(nome: string): Notificacao[] {
    return (this.porParticipante.get(nome) ?? []).slice();
  }
}
