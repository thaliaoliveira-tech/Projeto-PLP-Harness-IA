import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  type MessageEvent,
  NotFoundException,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import { type Observable, firstValueFrom, map } from 'rxjs';
import { LeiloesService } from '../aplicacao/leiloes.service.js';
import type { EventoLeilao, Leilao, Resultado } from '../dominio/tipos.js';
import { validarCriacao, validarLance } from './validacao.js';

const STATUS_DA_RECUSA = {
  LEILAO_ENCERRADO: HttpStatus.CONFLICT,
  PARTICIPANTE_JA_LIDERA: HttpStatus.UNPROCESSABLE_ENTITY,
  VALOR_ABAIXO_DO_MINIMO: HttpStatus.UNPROCESSABLE_ENTITY,
} as const;

function respostaDoLance(resultado: Resultado): {
  aceito: true;
  leilao: Leilao;
} {
  switch (resultado.tipo) {
    case 'LanceAceito':
      return { aceito: true, leilao: resultado.leilao };
    case 'LanceRecusado':
      throw new HttpException(
        { aceito: false, ...resultado, tipo: undefined },
        STATUS_DA_RECUSA[resultado.motivo],
      );
    case 'NaoEncontrado':
      throw new NotFoundException('leilão não encontrado');
    default:
      throw new Error(`resultado inesperado: ${resultado.tipo}`);
  }
}

@Controller('leiloes')
export class LeiloesController {
  constructor(private readonly leiloes: LeiloesService) {}

  @Post()
  criar(@Body() corpo: unknown): Observable<Leilao> {
    const validado = validarCriacao(corpo);
    if (!validado.ok) throw new BadRequestException(validado.erros);
    return this.leiloes
      .executar({ tipo: 'CriarLeilao', leilaoId: randomUUID(), ...validado.valor })
      .pipe(
        map((r) => {
          if (r.tipo !== 'Criado') throw new Error(`resultado inesperado: ${r.tipo}`);
          return r.leilao;
        }),
      );
  }

  @Get()
  listar(): Observable<Leilao[]> {
    return this.leiloes
      .estadoAtual()
      .pipe(map((estado) => [...estado.leiloes.values()].map((l) => l.leilao)));
  }

  @Get(':id')
  consultar(@Param('id') id: string): Observable<Leilao> {
    return this.leiloes.estadoAtual().pipe(
      map((estado) => {
        const atual = estado.leiloes.get(id);
        if (atual === undefined) throw new NotFoundException('leilão não encontrado');
        return atual.leilao;
      }),
    );
  }

  @Post(':id/lances')
  async darLance(
    @Param('id') id: string,
    @Body() corpo: unknown,
  ): Promise<{ aceito: true; leilao: Leilao }> {
    // Regra 1 (404) antes da regra 2 (400).
    const estado = await firstValueFrom(this.leiloes.estadoAtual());
    if (!estado.leiloes.has(id)) throw new NotFoundException('leilão não encontrado');
    const validado = validarLance(corpo);
    if (!validado.ok) throw new BadRequestException(validado.erros);
    const resultado = await firstValueFrom(
      this.leiloes.executar({ tipo: 'DarLance', leilaoId: id, ...validado.valor }),
    );
    return respostaDoLance(resultado);
  }

  @Get(':id/eventos')
  historico(@Param('id') id: string): Observable<readonly EventoLeilao[]> {
    return this.leiloes.estadoAtual().pipe(
      map((estado) => {
        const atual = estado.leiloes.get(id);
        if (atual === undefined) throw new NotFoundException('leilão não encontrado');
        return atual.eventos;
      }),
    );
  }

  @Sse(':id/stream')
  async acompanhar(@Param('id') id: string): Promise<Observable<MessageEvent>> {
    const estado = await firstValueFrom(this.leiloes.estadoAtual());
    if (!estado.leiloes.has(id)) throw new NotFoundException('leilão não encontrado');
    return this.leiloes
      .eventosDoLeilao(id)
      .pipe(map((evento): MessageEvent => ({ data: evento })));
  }
}
