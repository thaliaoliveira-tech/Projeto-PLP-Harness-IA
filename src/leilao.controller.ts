import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  Sse,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import { LeilaoService } from './leilao.service.js';
import type { Evento, Leilao, Notificacao } from './leilao.types.js';

function inteiroEntre(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function positivo(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

@Controller()
export class LeilaoController {
  constructor(@Inject(LeilaoService) private readonly service: LeilaoService) {}

  @Post('leiloes')
  criar(@Body() corpo: unknown): Promise<Leilao> {
    const c = (corpo ?? {}) as Record<string, unknown>;
    const prorrogacao = c.prorrogacaoSegundos ?? 0;
    if (
      typeof c.titulo !== 'string' ||
      c.titulo.trim() === '' ||
      !positivo(c.lanceInicial) ||
      !positivo(c.incrementoMinimo) ||
      !inteiroEntre(c.duracaoSegundos, 1, 86400) ||
      !inteiroEntre(prorrogacao, 0, 3600)
    ) {
      throw new BadRequestException();
    }
    return this.service.criar({
      titulo: c.titulo,
      lanceInicial: c.lanceInicial,
      incrementoMinimo: c.incrementoMinimo,
      duracaoSegundos: c.duracaoSegundos,
      prorrogacaoSegundos: prorrogacao,
    });
  }

  @Get('leiloes')
  listar(): Leilao[] {
    return this.service.listar();
  }

  @Get('leiloes/:id')
  obter(@Param('id') id: string): Leilao {
    const l = this.service.obter(id);
    if (!l) throw new NotFoundException();
    return l;
  }

  @Post('leiloes/:id/lances')
  async lance(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.service.darLance(id, corpo);
    if (r.status === 404) throw new NotFoundException();
    if (r.status === 400) throw new BadRequestException();
    res.status(r.status);
    return r.corpo;
  }

  @Get('leiloes/:id/eventos')
  eventos(@Param('id') id: string): Evento[] {
    const e = this.service.eventos(id);
    if (!e) throw new NotFoundException();
    return e;
  }

  @Sse('leiloes/:id/stream')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    const s = this.service.stream(id);
    if (!s) throw new NotFoundException();
    return s.pipe(map((e): MessageEvent => ({ data: e })));
  }

  @Get('participantes/:nome/notificacoes')
  notificacoes(@Param('nome') nome: string): Notificacao[] {
    return this.service.notificacoesDe(nome);
  }
}
