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

const inteiro = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const positivo = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

@Controller()
export class LeiloesController {
  constructor(private readonly leiloes: LeilaoService) {}

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
    return this.leiloes.obter(id);
  }

  @Post('leiloes/:id/lances')
  lance(@Param('id') id: string, @Body() corpo: unknown) {
    return this.leiloes.darLance(id, corpo).pipe(
      map((r) => {
        if (r.status === 201) return r.corpo;
        if (r.status === 404) throw new NotFoundException();
        if (r.status === 400) {
          throw new HttpException({ erro: 'Corpo inválido' }, 400);
        }
        throw new HttpException(r.corpo, r.status);
      }),
    );
  }

  @Get('leiloes/:id/eventos')
  eventos(@Param('id') id: string) {
    return this.leiloes.eventos(id);
  }

  @Sse('leiloes/:id/stream')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.leiloes.stream(id).pipe(map((ev) => ({ data: ev })));
  }
}
