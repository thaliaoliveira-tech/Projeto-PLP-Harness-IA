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
import { firstValueFrom, map, Observable } from 'rxjs';
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
  criar(@Body() corpo: unknown): Observable<Leilao> {
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
    return this.service.criar$({
      titulo: c.titulo,
      lanceInicial: c.lanceInicial,
      incrementoMinimo: c.incrementoMinimo,
      duracaoSegundos: c.duracaoSegundos,
      prorrogacaoSegundos: prorrogacao,
    });
  }

  @Get('leiloes')
  listar(): Observable<Leilao[]> {
    return this.service.listar$();
  }

  @Get('leiloes/:id')
  obter(@Param('id') id: string): Observable<Leilao> {
    return this.service.obter$(id).pipe(map((l) => this.ou404(l)));
  }

  @Post('leiloes/:id/lances')
  lance(
    @Param('id') id: string,
    @Body() corpo: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.service.darLance$(id, corpo).pipe(
      map((r) => {
        if (r.status === 404) throw new NotFoundException();
        if (r.status === 400) throw new BadRequestException();
        res.status(r.status);
        return r.corpo;
      }),
    );
  }

  @Get('leiloes/:id/eventos')
  eventos(@Param('id') id: string): Observable<readonly Evento[]> {
    return this.service.eventos$(id).pipe(map((e) => this.ou404(e)));
  }

  // O 404 precisa sair antes de o SSE enviar os cabeçalhos, por isso a checagem prévia.
  @Sse('leiloes/:id/stream')
  async stream(@Param('id') id: string): Promise<Observable<MessageEvent>> {
    this.ou404(await firstValueFrom(this.service.obter$(id)));
    return this.service.stream$(id).pipe(map((e): MessageEvent => ({ data: e })));
  }

  @Get('participantes/:nome/notificacoes')
  notificacoes(@Param('nome') nome: string): Observable<readonly Notificacao[]> {
    return this.service.notificacoesDe$(nome);
  }

  private ou404<T>(v: T | undefined): T {
    if (v === undefined) throw new NotFoundException();
    return v;
  }
}
