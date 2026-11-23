import { Module } from '@nestjs/common';
import { LeilaoService } from './leilao.service.js';
import { LeiloesController } from './leiloes.controller.js';
import { NotificacoesService } from './notificacoes.service.js';

@Module({
  controllers: [LeiloesController],
  providers: [LeilaoService, NotificacoesService],
})
export class AppModule {}
