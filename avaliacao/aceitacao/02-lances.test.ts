import { describe, expect, test } from 'vitest';
import { ISO_UTC, api, consultar, criarLeilao, lance, unico } from './util.js';

describe('Lances', () => {
  test('primeiro lance igual ao lanceInicial é aceito (201) e atualiza o leilão', async () => {
    const l = await criarLeilao({ lanceInicial: 100, incrementoMinimo: 10 });
    const ana = unico('ana');
    const r = await lance(l.id, ana, 100);
    expect(r.status).toBe(201);
    expect(r.corpo.aceito).toBe(true);
    expect(r.corpo.leilao).toMatchObject({
      id: l.id,
      status: 'ABERTO',
      totalLances: 1,
      maiorLance: { participante: ana, valor: 100, ocorridoEm: expect.stringMatching(ISO_UTC) },
    });
    const atual = await consultar(l.id);
    expect(atual.maiorLance).toMatchObject({ participante: ana, valor: 100 });
    expect(atual.totalLances).toBe(1);
  });

  test('primeiro lance abaixo do lanceInicial é recusado com 422 VALOR_ABAIXO_DO_MINIMO e valorMinimo', async () => {
    const l = await criarLeilao({ lanceInicial: 100, incrementoMinimo: 10 });
    const r = await lance(l.id, unico('ana'), 99);
    expect(r.status).toBe(422);
    expect(r.corpo).toEqual({ aceito: false, motivo: 'VALOR_ABAIXO_DO_MINIMO', valorMinimo: 100 });
  });

  test('lance menor que maiorLance + incrementoMinimo é recusado com 422 e valorMinimo correto', async () => {
    const l = await criarLeilao({ lanceInicial: 100, incrementoMinimo: 10 });
    expect((await lance(l.id, unico('ana'), 150)).status).toBe(201);
    const r = await lance(l.id, unico('bia'), 155);
    expect(r.status).toBe(422);
    expect(r.corpo).toEqual({ aceito: false, motivo: 'VALOR_ABAIXO_DO_MINIMO', valorMinimo: 160 });
  });

  test('lance exatamente igual a maiorLance + incrementoMinimo é aceito', async () => {
    const l = await criarLeilao({ lanceInicial: 100, incrementoMinimo: 10 });
    expect((await lance(l.id, unico('ana'), 150)).status).toBe(201);
    const bia = unico('bia');
    const r = await lance(l.id, bia, 160);
    expect(r.status).toBe(201);
    expect(r.corpo.leilao.maiorLance).toMatchObject({ participante: bia, valor: 160 });
    expect(r.corpo.leilao.totalLances).toBe(2);
  });

  test('participante que já lidera é recusado com 422 PARTICIPANTE_JA_LIDERA (mesmo com valor maior)', async () => {
    const l = await criarLeilao({ lanceInicial: 100, incrementoMinimo: 10 });
    const ana = unico('ana');
    expect((await lance(l.id, ana, 100)).status).toBe(201);
    const r = await lance(l.id, ana, 500);
    expect(r.status).toBe(422);
    expect(r.corpo).toEqual({ aceito: false, motivo: 'PARTICIPANTE_JA_LIDERA' });
  });

  test('lance em leilão inexistente responde 404 (antes de validar o corpo)', async () => {
    const id = unico('nao-existe');
    expect((await lance(id, unico('ana'), 100)).status).toBe(404);
    expect((await api('POST', `/leiloes/${id}/lances`, {})).status).toBe(404);
  });

  test.each([
    ['participante vazio', { participante: '', valor: 100 }],
    ['valor igual a zero', { participante: 'ana', valor: 0 }],
    ['valor que não é número', { participante: 'ana', valor: 'abc' }],
  ])('lance com %s responde 400', async (_nome, corpo) => {
    const l = await criarLeilao();
    const r = await api('POST', `/leiloes/${l.id}/lances`, corpo);
    expect(r.status).toBe(400);
  });

  test('lances recusados não alteram maiorLance nem totalLances', async () => {
    const l = await criarLeilao({ lanceInicial: 100, incrementoMinimo: 10 });
    const ana = unico('ana');
    expect((await lance(l.id, ana, 120)).status).toBe(201);
    expect((await lance(l.id, unico('bia'), 125)).status).toBe(422);
    expect((await lance(l.id, ana, 300)).status).toBe(422);
    const atual = await consultar(l.id);
    expect(atual.totalLances).toBe(1);
    expect(atual.maiorLance).toMatchObject({ participante: ana, valor: 120 });
  });
});
