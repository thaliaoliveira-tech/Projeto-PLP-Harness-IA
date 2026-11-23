import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('Leilões (e2e)', () => {
  let app: INestApplication;
  const http = () => app.getHttpServer();

  beforeEach(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterEach(() => app.close());

  const criar = async (extra = {}) =>
    (
      await request(http())
        .post('/leiloes')
        .send({ titulo: 'Bike', lanceInicial: 100, incrementoMinimo: 10, duracaoSegundos: 60, ...extra })
        .expect(201)
    ).body;

  it('valida criação', async () => {
    await request(http()).post('/leiloes').send({ titulo: ' ', lanceInicial: 1, incrementoMinimo: 1, duracaoSegundos: 1 }).expect(400);
    await request(http()).post('/leiloes').send({ titulo: 'a', lanceInicial: 1, incrementoMinimo: 1, duracaoSegundos: 1.5 }).expect(400);
  });

  it('regras de lance, eventos e notificações', async () => {
    const l = await criar();
    expect(l.status).toBe('ABERTO');
    const url = `/leiloes/${l.id}/lances`;
    await request(http()).post('/leiloes/x/lances').send({}).expect(404);
    await request(http()).post(url).send({ participante: '', valor: 1 }).expect(400);
    await request(http()).post(url).send({ participante: 'ana', valor: 99 }).expect(422, { aceito: false, motivo: 'VALOR_ABAIXO_DO_MINIMO', valorMinimo: 100 });
    await request(http()).post(url).send({ participante: 'ana', valor: 100 }).expect(201);
    await request(http()).post(url).send({ participante: 'ana', valor: 500 }).expect(422, { aceito: false, motivo: 'PARTICIPANTE_JA_LIDERA' });
    await request(http()).post(url).send({ participante: 'bia', valor: 110 }).expect(201);
    const ev = (await request(http()).get(`/leiloes/${l.id}/eventos`).expect(200)).body;
    expect(ev.map((e: any) => e.tipo)).toEqual(['LeilaoCriado', 'LanceRejeitado', 'LanceAceito', 'LanceRejeitado', 'LanceAceito']);
    expect(ev.map((e: any) => e.sequencia)).toEqual([1, 2, 3, 4, 5]);
    const n = (await request(http()).get('/participantes/ana/notificacoes').expect(200)).body;
    expect(n).toMatchObject([{ tipo: 'LANCE_SUPERADO', valorAnterior: 100, novoValor: 110 }]);
  });

  it('lances simultâneos são serializados', async () => {
    const l = await criar();
    const rs = await Promise.all(
      Array.from({ length: 20 }, (_, i) => request(http()).post(`/leiloes/${l.id}/lances`).send({ participante: `p${i}`, valor: 100 + i * 10 })),
    );
    const aceitos = rs.filter((r) => r.status === 201).length;
    const got = (await request(http()).get(`/leiloes/${l.id}`)).body;
    expect(got.totalLances).toBe(aceitos);
    const ev = (await request(http()).get(`/leiloes/${l.id}/eventos`)).body;
    expect(ev.map((e: any) => e.sequencia)).toEqual(ev.map((_: any, i: number) => i + 1));
  });

  it('encerra sozinho, prorroga e fecha o stream', async () => {
    const l = await criar({ duracaoSegundos: 1, prorrogacaoSegundos: 2 });
    await request(http()).post(`/leiloes/${l.id}/lances`).send({ participante: 'ana', valor: 100 }).expect(201);
    const ev1 = (await request(http()).get(`/leiloes/${l.id}/eventos`)).body;
    expect(ev1.at(-1).tipo).toBe('LeilaoProrrogado');
    const res = await request(http()).get(`/leiloes/${l.id}/stream`).buffer(true).parse((r, cb) => {
      let d = '';
      r.on('data', (c: Buffer) => (d += c));
      r.on('end', () => cb(null, d as any));
    });
    expect(res.headers['content-type']).toContain('text/event-stream');
    const tipos = [...(res.body as string).matchAll(/data: (.*)/g)].map((m) => JSON.parse(m[1]).tipo);
    expect(tipos).toEqual(['LeilaoCriado', 'LanceAceito', 'LeilaoProrrogado', 'LeilaoEncerrado']);
    const fim = (await request(http()).get(`/leiloes/${l.id}`)).body;
    expect(fim).toMatchObject({ status: 'ENCERRADO', vencedor: 'ana' });
    await request(http()).post(`/leiloes/${l.id}/lances`).send({ participante: 'bia', valor: 999 }).expect(409, { aceito: false, motivo: 'LEILAO_ENCERRADO' });
    const n = (await request(http()).get('/participantes/ana/notificacoes')).body;
    expect(n[0]).toMatchObject({ tipo: 'LEILAO_VENCIDO', valor: 100 });
  }, 10000);
});
