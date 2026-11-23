import { Module } from '@nestjs/common';
import { LeiloesModule } from './leiloes/leiloes.module.js';

@Module({
  imports: [LeiloesModule],
})
export class AppModule {}
