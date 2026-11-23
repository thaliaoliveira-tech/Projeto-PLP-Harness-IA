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
import { type Observable, defaultIfEmpty, firstValueFrom, map, switchMap, throwError } from 'rxjs';
import { LeiloesService } from '../aplicacao/leiloes.service.js';
import type { Evento, Leilao, Resultado } from '../dominio/tipos.js';
import { randomUUID } from 'node:crypto';
import { validarNovoLance, validarNovoLeilao } from './validacao.js';

const naoEncontrado = () => new NotFoundException('Leilão não encontrado');

@Controller('leiloes')
export class LeiloesController {
  constructor(private readonly leiloes: LeiloesService) {}

  @Post()
  criar(@Body() corpo: unknown): Observable<Leilao> {
    const v = validarNovoLeilao(corpo);
    if (!v.ok) throw new BadRequestException(v.erro);
    return this.leiloes.executar({ tipo: 'CriarLeilao', leilaoId: randomUUID(), ...v.valor }).pipe(
      map((r) => (r.tipo === 'CRIADO' ? r.leilao : fail(r))),
    );
  }

  @Get()
  listar(): Observable<Leilao[]> {
    return this.leiloes.listar();
  }

  @Get(':id')
  consultar(@Param('id') id: string): Observable<Leilao> {
    return this.existente(id);
  }

  @Post(':id/lances')
  darLance(@Param('id') id: string, @Body() corpo: unknown): Observable<unknown> {
    return this.existente(id).pipe(
      switchMap(() => {
        const v = validarNovoLance(corpo);
        if (!v.ok) return throwError(() => new BadRequestException(v.erro));
        return this.leiloes.executar({ tipo: 'DarLance', leilaoId: id, ...v.valor });
      }),
      map((r) => {
        switch (r.tipo) {
          case 'ACEITO':
            return { aceito: true, leilao: r.leilao };
          case 'NAO_ENCONTRADO':
            throw naoEncontrado();
          case 'REJEITADO': {
            const { tipo: _tipo, ...resto } = r;
            throw new HttpException({ aceito: false, ...resto }, r.motivo === 'LEILAO_ENCERRADO' ? 409 : 422);
          }
          default:
            return fail(r);
        }
      }),
    );
  }

  @Get(':id/eventos')
  eventos(@Param('id') id: string): Observable<readonly Evento[]> {
    return this.leiloes.historico(id).pipe(defaultIfEmpty(null), map((h) => h ?? orFail()));
  }

  @Sse(':id/stream')
  async stream(@Param('id') id: string): Promise<Observable<MessageEvent>> {
    // 404 antes de abrir o stream
    await firstValueFrom(this.existente(id));
    return this.leiloes.acompanhar(id).pipe(map((e) => ({ data: e })));
  }

  private existente(id: string): Observable<Leilao> {
    return this.leiloes.obter(id).pipe(
      defaultIfEmpty(null),
      map((l) => l ?? orFail()),
    );
  }
}

function orFail(): never {
  throw naoEncontrado();
}

function fail(r: Resultado): never {
  throw new Error(`resultado inesperado: ${r.tipo}`);
}
