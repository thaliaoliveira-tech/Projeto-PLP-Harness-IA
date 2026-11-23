import { Controller, Get, Param } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { NotificacoesService } from '../aplicacao/notificacoes.service.js';
import type { Notificacao } from '../dominio/tipos.js';

@Controller('participantes')
export class NotificacoesController {
  constructor(private readonly notificacoes: NotificacoesService) {}

  @Get(':nome/notificacoes')
  listar(@Param('nome') nome: string): Observable<readonly Notificacao[]> {
    return this.notificacoes.deParticipante(nome);
  }
}
