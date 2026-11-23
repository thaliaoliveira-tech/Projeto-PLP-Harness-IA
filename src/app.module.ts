import { Module } from '@nestjs/common';
import { LeiloesModule } from './leiloes/leiloes.module.js';
import { NotificacoesModule } from './notificacoes/notificacoes.module.js';

@Module({ imports: [LeiloesModule, NotificacoesModule] })
export class AppModule {}
