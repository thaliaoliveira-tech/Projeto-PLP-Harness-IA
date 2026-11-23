import { Body, Controller, Get, HttpCode, Param, Post, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { LeiloesService } from './leiloes.service.js';

@Controller()
export class LeiloesController {
  constructor(private readonly service: LeiloesService) {}

  @Post('leiloes')
  criar(@Body() body: unknown) {
    return this.service.criar(body);
  }

  @Get('leiloes')
  listar() {
    return this.service.listar();
  }

  @Get('leiloes/:id')
  obter(@Param('id') id: string) {
    return this.service.obter(id);
  }

  @Post('leiloes/:id/lances')
  @HttpCode(201)
  darLance(@Param('id') id: string, @Body() body: unknown) {
    return this.service.darLance(id, body);
  }

  @Get('leiloes/:id/eventos')
  eventos(@Param('id') id: string) {
    return this.service.eventos(id);
  }

  @Sse('leiloes/:id/stream')
  stream(@Param('id') id: string): Observable<{ data: unknown }> {
    return this.service.stream(id).pipe(map((data) => ({ data })));
  }

  @Get('participantes/:nome/notificacoes')
  notificacoes(@Param('nome') nome: string) {
    return this.service.notificacoesDe(nome);
  }
}
