import { Module } from '@nestjs/common';
import { LeilaoController } from './leilao.controller.js';
import { LeilaoService } from './leilao.service.js';

@Module({
  controllers: [LeilaoController],
  providers: [LeilaoService],
})
export class AppModule {}
