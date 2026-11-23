import { Module } from '@nestjs/common';
import { LeiloesModule } from '../leiloes/leiloes.module.js';
import { NotificacoesService } from './aplicacao/notificacoes.service.js';
import { NotificacoesController } from './http/notificacoes.controller.js';

@Module({
  imports: [LeiloesModule],
  controllers: [NotificacoesController],
  providers: [NotificacoesService],
})
export class NotificacoesModule {}
