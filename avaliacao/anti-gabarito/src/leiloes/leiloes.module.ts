import { Module } from '@nestjs/common';
import { NotificacoesModule } from '../notificacoes/notificacoes.module.js';
import { LeiloesController } from './leiloes.controller.js';
import { LeiloesService } from './leiloes.service.js';

@Module({
  imports: [NotificacoesModule],
  controllers: [LeiloesController],
  providers: [LeiloesService],
})
export class LeiloesModule {}
