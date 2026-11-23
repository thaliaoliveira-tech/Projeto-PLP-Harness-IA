import { Controller, Get, Param } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service.js';

@Controller('participantes')
export class ParticipantesController {
  constructor(private readonly notificacoes: NotificacoesService) {}

  @Get(':nome/notificacoes')
  notificacoesDe(@Param('nome') nome: string) {
    return this.notificacoes.listar(nome);
  }
}
