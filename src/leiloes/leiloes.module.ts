import { Module } from '@nestjs/common';
import { LeiloesService } from './aplicacao/leiloes.service.js';
import { LeiloesController } from './http/leiloes.controller.js';

@Module({ controllers: [LeiloesController], providers: [LeiloesService], exports: [LeiloesService] })
export class LeiloesModule {}
