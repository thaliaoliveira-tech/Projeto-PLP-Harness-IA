import { Module } from '@nestjs/common';
import { LeiloesController } from './leiloes/leiloes.controller.js';
import { LeiloesService } from './leiloes/leiloes.service.js';

@Module({
  controllers: [LeiloesController],
  providers: [LeiloesService],
})
export class AppModule {}
