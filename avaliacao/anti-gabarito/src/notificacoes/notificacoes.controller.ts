import { Controller, Get, Param } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service.js';

@Controller('participantes')
export class NotificacoesController {
  constructor(private readonly service: NotificacoesService) {}

  @Get(':nome/notificacoes')
  listar(@Param('nome') nome: string) {
    return this.service.listar(nome);
  }
}
