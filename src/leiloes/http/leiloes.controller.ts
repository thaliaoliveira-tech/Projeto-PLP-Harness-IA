import { randomUUID } from 'node:crypto';
import {
  BadRequestException, Body, Controller, Get, HttpException, HttpStatus, type MessageEvent,
  NotFoundException, Param, Post, Sse,
} from '@nestjs/common';
import { type Observable, firstValueFrom, map } from 'rxjs';
import { LeiloesService } from '../aplicacao/leiloes.service.js';
import type { Evento, Leilao } from '../dominio/tipos.js';
import { validarCriacao, validarLance } from './validacao.js';

const STATUS = {
  LEILAO_ENCERRADO: HttpStatus.CONFLICT,
  PARTICIPANTE_JA_LIDERA: HttpStatus.UNPROCESSABLE_ENTITY,
  VALOR_ABAIXO_DO_MINIMO: HttpStatus.UNPROCESSABLE_ENTITY,
} as const;

@Controller('leiloes')
export class LeiloesController {
  constructor(private readonly leiloes: LeiloesService) {}

  @Post()
  criar(@Body() corpo: unknown): Observable<Leilao> {
    const v = validarCriacao(corpo);
    if (!v.ok) throw new BadRequestException(v.erros);
    return this.leiloes.executar({ tipo: 'Criar', leilaoId: randomUUID(), ...v.valor }).pipe(
      map((r) => {
        if (r.tipo !== 'Ok') throw new Error('resultado inesperado');
        return r.leilao;
      }),
    );
  }

  @Get()
  listar(): Observable<Leilao[]> {
    return this.leiloes.estadoAtual().pipe(map((e) => [...e.values()].map((x) => x.leilao)));
  }

  @Get(':id')
  consultar(@Param('id') id: string): Observable<Leilao> {
    return this.leiloes.estadoAtual().pipe(
      map((e) => {
        const x = e.get(id);
        if (x === undefined) throw new NotFoundException();
        return x.leilao;
      }),
    );
  }

  @Post(':id/lances')
  async lance(@Param('id') id: string, @Body() corpo: unknown): Promise<{ aceito: true; leilao: Leilao }> {
    const estado = await firstValueFrom(this.leiloes.estadoAtual());
    if (!estado.has(id)) throw new NotFoundException();
    const v = validarLance(corpo);
    if (!v.ok) throw new BadRequestException(v.erros);
    const r = await firstValueFrom(this.leiloes.executar({ tipo: 'Lance', leilaoId: id, ...v.valor }));
    if (r.tipo === 'Ok') return { aceito: true, leilao: r.leilao };
    if (r.tipo === 'Recusado') {
      const { tipo: _tipo, ...resto } = r;
      throw new HttpException({ aceito: false, ...resto }, STATUS[r.motivo]);
    }
    throw new NotFoundException();
  }

  @Get(':id/eventos')
  historico(@Param('id') id: string): Observable<Evento[]> {
    return this.leiloes.estadoAtual().pipe(
      map((e) => {
        const x = e.get(id);
        if (x === undefined) throw new NotFoundException();
        return x.eventos;
      }),
    );
  }

  @Sse(':id/stream')
  async stream(@Param('id') id: string): Promise<Observable<MessageEvent>> {
    const estado = await firstValueFrom(this.leiloes.estadoAtual());
    if (!estado.has(id)) throw new NotFoundException();
    return this.leiloes.eventosDoLeilao(id).pipe(map((e): MessageEvent => ({ data: e })));
  }
}
