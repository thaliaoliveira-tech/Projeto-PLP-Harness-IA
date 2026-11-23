import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Param,
  Post,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { type Observable, firstValueFrom, map, switchMap } from 'rxjs';
import { LeiloesService } from '../aplicacao/leiloes.service.js';
import { paraLeilao } from '../dominio/regras.js';
import type { EventoLeilao, Leilao } from '../dominio/tipos.js';
import { validarCriacao, validarLance } from './validacao.js';

const naoEncontrado = () => new NotFoundException();

@Controller('leiloes')
export class LeiloesController {
  constructor(private readonly leiloes: LeiloesService) {}

  @Post()
  criar(@Body() corpo: unknown): Observable<Leilao> {
    const v = validarCriacao(corpo);
    if (!v.valido) throw new BadRequestException();
    return this.leiloes.criar(v.valor);
  }

  @Get()
  listar(): Observable<Leilao[]> {
    return this.leiloes.listar();
  }

  @Get(':id')
  obter(@Param('id') id: string): Observable<Leilao> {
    return this.leiloes.obter(id).pipe(
      map((l) => {
        if (!l) throw naoEncontrado();
        return l;
      }),
    );
  }

  @Post(':id/lances')
  darLance(
    @Param('id') id: string,
    @Body() corpo: unknown,
  ): Observable<unknown> {
    return this.leiloes.obter(id).pipe(
      switchMap((existente) => {
        if (!existente) throw naoEncontrado();
        const v = validarLance(corpo);
        if (!v.valido) throw new BadRequestException();
        return this.leiloes.darLance(id, v.valor.participante, v.valor.valor);
      }),
      map(({ resposta, estado }) => {
        switch (resposta.tipo) {
          case 'LANCE_ACEITO':
            return { aceito: true, leilao: paraLeilao(estado.leiloes[id]!) };
          case 'LEILAO_ENCERRADO':
            throw new HttpException(
              { aceito: false, motivo: 'LEILAO_ENCERRADO' },
              409,
            );
          case 'LANCE_RECUSADO': {
            const { tipo: _tipo, ...detalhe } = resposta;
            throw new HttpException({ aceito: false, ...detalhe }, 422);
          }
          default:
            throw naoEncontrado();
        }
      }),
    );
  }

  @Get(':id/eventos')
  eventos(@Param('id') id: string): Observable<readonly EventoLeilao[]> {
    return this.leiloes.historico(id).pipe(
      map((h) => {
        if (!h) throw naoEncontrado();
        return h;
      }),
    );
  }

  @Sse(':id/stream')
  async stream(@Param('id') id: string): Promise<Observable<MessageEvent>> {
    if (!(await firstValueFrom(this.leiloes.obter(id)))) throw naoEncontrado();
    return this.leiloes.stream(id).pipe(map((e) => ({ data: e })));
  }
}
