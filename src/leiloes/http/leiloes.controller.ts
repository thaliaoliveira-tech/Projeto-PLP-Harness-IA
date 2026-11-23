import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Sse,
  UnprocessableEntityException,
  type MessageEvent,
} from '@nestjs/common';
import {
  concatMap,
  firstValueFrom,
  map,
  type Observable,
  throwError,
} from 'rxjs';
import { LeiloesService } from '../aplicacao/leiloes.service.js';
import { validarNovoLance, validarNovoLeilao } from '../dominio/validacao.js';
import type { EventoLeilao, Leilao } from '../dominio/tipos.js';

@Controller('leiloes')
export class LeiloesController {
  constructor(private readonly leiloes: LeiloesService) {}

  @Post()
  criar(@Body() corpo: unknown): Observable<Leilao> {
    const v = validarNovoLeilao(corpo);
    if (!v.valido)
      return throwError(() => new BadRequestException('Corpo inválido'));
    return this.leiloes.criar(v.valor).pipe(map((r) => r.leilao!));
  }

  @Get()
  listar(): Observable<Leilao[]> {
    return this.leiloes.listar();
  }

  @Get(':id')
  consultar(@Param('id') id: string): Observable<Leilao> {
    return this.leiloes.obter(id).pipe(map((l) => this.existente(l)));
  }

  @Post(':id/lances')
  darLance(
    @Param('id') id: string,
    @Body() corpo: unknown,
  ): Observable<{ aceito: true; leilao: Leilao }> {
    return this.leiloes.obter(id).pipe(
      map((l) => this.existente(l)),
      concatMap(() => {
        const v = validarNovoLance(corpo);
        if (!v.valido)
          return throwError(() => new BadRequestException('Corpo inválido'));
        return this.leiloes.executar({
          tipo: 'DarLance',
          leilaoId: id,
          dados: v.valor,
        });
      }),
      map(({ resultado, leilao }) => {
        switch (resultado.tipo) {
          case 'LANCE_ACEITO':
            return { aceito: true as const, leilao: leilao! };
          case 'LANCE_RECUSADO': {
            const { motivo, valorMinimo } = resultado;
            const corpoErro = {
              aceito: false,
              motivo,
              ...(valorMinimo === undefined ? {} : { valorMinimo }),
            };
            if (motivo === 'LEILAO_ENCERRADO')
              throw new ConflictException(corpoErro);
            throw new UnprocessableEntityException(corpoErro);
          }
          default:
            throw new NotFoundException();
        }
      }),
    );
  }

  @Get(':id/eventos')
  eventos(@Param('id') id: string): Observable<readonly EventoLeilao[]> {
    return this.leiloes.eventosDe(id).pipe(map((e) => this.existente(e)));
  }

  @Sse(':id/stream')
  async stream(@Param('id') id: string): Promise<Observable<MessageEvent>> {
    this.existente(await firstValueFrom(this.leiloes.obter(id)));
    return this.leiloes.acompanhar(id).pipe(map((e) => ({ data: e })));
  }

  private existente<T>(valor: T | null): T {
    if (valor === null)
      throw new HttpException('Leilão não encontrado', HttpStatus.NOT_FOUND);
    return valor;
  }
}
