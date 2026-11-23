// ANTI-GABARITO: controller imperativo (assina o Subject manualmente para o SSE).
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  type MessageEvent,
  NotFoundException,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { LeiloesService } from './leiloes.service.js';

const positivo = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const inteiroEntre = (v: unknown, a: number, b: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= a && v <= b;

@Controller('leiloes')
export class LeiloesController {
  constructor(private readonly service: LeiloesService) {}

  @Post()
  criar(@Body() body: any) {
    const prorrogacao = body?.prorrogacaoSegundos ?? 0;
    if (
      typeof body?.titulo !== 'string' || body.titulo.trim() === '' ||
      !positivo(body.lanceInicial) || !positivo(body.incrementoMinimo) ||
      !inteiroEntre(body.duracaoSegundos, 1, 86400) || !inteiroEntre(prorrogacao, 0, 3600)
    ) {
      throw new BadRequestException('dados inválidos');
    }
    return this.service.criar({ ...body, titulo: body.titulo.trim(), prorrogacaoSegundos: prorrogacao });
  }

  @Get()
  listar() {
    return this.service.listar();
  }

  @Get(':id')
  buscar(@Param('id') id: string) {
    const l = this.service.buscar(id);
    if (!l) throw new NotFoundException();
    return l;
  }

  @Post(':id/lances')
  lance(@Param('id') id: string, @Body() body: any) {
    if (!this.service.buscar(id)) throw new NotFoundException();
    if (typeof body?.participante !== 'string' || body.participante.trim() === '' || !positivo(body.valor)) {
      throw new BadRequestException('dados inválidos');
    }
    const r = this.service.darLance(id, body.participante, body.valor);
    if (r.status !== 201) throw new HttpException(r.corpo, r.status);
    return r.corpo;
  }

  @Get(':id/eventos')
  eventos(@Param('id') id: string) {
    if (!this.service.buscar(id)) throw new NotFoundException();
    return this.service.historico(id);
  }

  @Sse(':id/stream')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    if (!this.service.buscar(id)) throw new NotFoundException();
    return new Observable<MessageEvent>((sub) => {
      const historico = this.service.historico(id);
      for (const e of historico) sub.next({ data: e });
      if (historico.at(-1)?.tipo === 'LeilaoEncerrado') {
        sub.complete();
        return;
      }
      const s = this.service.eventos$.subscribe((e) => {
        if (e.leilaoId !== id) return;
        sub.next({ data: e });
        if (e.tipo === 'LeilaoEncerrado') sub.complete();
      });
      return () => s.unsubscribe();
    });
  }
}
