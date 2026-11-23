import {
  Body,
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { LeilaoService } from './leilao.service.js';
import { NotificacoesService } from './notificacoes.service.js';

const inteiro = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const positivo = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

@Controller()
export class LeiloesController {
  constructor(
    private readonly leiloes: LeilaoService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  @Post('leiloes')
  criar(@Body() corpo: unknown) {
    const b = (corpo ?? {}) as Record<string, unknown>;
    const { titulo, lanceInicial, incrementoMinimo, duracaoSegundos } = b;
    const prorrogacaoSegundos = b.prorrogacaoSegundos ?? 0;
    if (
      typeof titulo !== 'string' ||
      titulo.trim() === '' ||
      !positivo(lanceInicial) ||
      !positivo(incrementoMinimo) ||
      !inteiro(duracaoSegundos, 1, 86400) ||
      !inteiro(prorrogacaoSegundos, 0, 3600)
    ) {
      throw new HttpException({ erro: 'Corpo inválido' }, 400);
    }
    return this.leiloes.criar({
      titulo,
      lanceInicial,
      incrementoMinimo,
      duracaoSegundos,
      prorrogacaoSegundos,
    });
  }

  @Get('leiloes')
  listar() {
    return this.leiloes.listar();
  }

  @Get('leiloes/:id')
  obter(@Param('id') id: string) {
    const l = this.leiloes.obter(id);
    if (!l) throw new NotFoundException();
    return l;
  }

  @Post('leiloes/:id/lances')
  async lance(@Param('id') id: string, @Body() corpo: unknown) {
    const r = await this.leiloes.darLance(id, corpo);
    if (r.status === 201) return r.corpo;
    if (r.status === 404) throw new NotFoundException();
    if (r.status === 400) {
      throw new HttpException({ erro: 'Corpo inválido' }, 400);
    }
    throw new HttpException(r.corpo, r.status);
  }

  @Get('leiloes/:id/eventos')
  eventos(@Param('id') id: string) {
    const e = this.leiloes.eventos(id);
    if (!e) throw new NotFoundException();
    return e;
  }

  @Sse('leiloes/:id/stream')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    const s = this.leiloes.stream(id);
    if (!s) throw new NotFoundException();
    return s.pipe(map((ev) => ({ data: ev })));
  }

  @Get('participantes/:nome/notificacoes')
  notificacoesDe(@Param('nome') nome: string) {
    return this.notificacoes.listar(nome);
  }
}
