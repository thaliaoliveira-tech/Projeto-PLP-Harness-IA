import { describe, expect, test } from 'vitest';
import { ISO_UTC, api, criarLeilao, unico } from './util.js';

describe('Criação e consulta de leilões', () => {
  test('POST /leiloes cria leilão (201) com todos os campos do recurso Leilao', async () => {
    const titulo = unico('Bicicleta');
    const antes = Date.now();
    const r = await api('POST', '/leiloes', {
      titulo,
      lanceInicial: 100,
      incrementoMinimo: 10,
      duracaoSegundos: 60,
      prorrogacaoSegundos: 5,
    });
    expect(r.status).toBe(201);
    expect(r.corpo).toEqual({
      id: expect.any(String),
      titulo,
      lanceInicial: 100,
      incrementoMinimo: 10,
      prorrogacaoSegundos: 5,
      status: 'ABERTO',
      maiorLance: null,
      totalLances: 0,
      encerraEm: expect.stringMatching(ISO_UTC),
      vencedor: null,
    });
    const encerraEm = Date.parse(r.corpo.encerraEm);
    expect(encerraEm).toBeGreaterThanOrEqual(antes + 60_000 - 1000);
    expect(encerraEm).toBeLessThanOrEqual(Date.now() + 60_000 + 1000);
  });

  test('prorrogacaoSegundos é opcional e vale 0 por padrão', async () => {
    const r = await api('POST', '/leiloes', {
      titulo: unico('Item'),
      lanceInicial: 50,
      incrementoMinimo: 5,
      duracaoSegundos: 30,
    });
    expect(r.status).toBe(201);
    expect(r.corpo.prorrogacaoSegundos).toBe(0);
  });

  test('ids gerados são únicos', async () => {
    const [a, b] = await Promise.all([criarLeilao(), criarLeilao()]);
    expect(a.id).not.toBe(b.id);
  });

  test.each([
    ['titulo vazio', { titulo: '   ' }],
    ['lanceInicial igual a zero', { lanceInicial: 0 }],
    ['incrementoMinimo negativo', { incrementoMinimo: -5 }],
    ['duracaoSegundos igual a zero', { duracaoSegundos: 0 }],
    ['duracaoSegundos não inteiro', { duracaoSegundos: 1.5 }],
    ['prorrogacaoSegundos negativo', { prorrogacaoSegundos: -1 }],
  ])('POST /leiloes com %s responde 400', async (_nome, invalido) => {
    const r = await api('POST', '/leiloes', {
      titulo: unico('Item'),
      lanceInicial: 100,
      incrementoMinimo: 10,
      duracaoSegundos: 60,
      ...invalido,
    });
    expect(r.status).toBe(400);
  });

  test('GET /leiloes/:id devolve o leilão criado', async () => {
    const criado = await criarLeilao();
    const r = await api('GET', `/leiloes/${criado.id}`);
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual(criado);
  });

  test('GET /leiloes/:id de leilão inexistente responde 404', async () => {
    const r = await api('GET', `/leiloes/${unico('nao-existe')}`);
    expect(r.status).toBe(404);
  });

  test('GET /leiloes lista os leilões na ordem de criação', async () => {
    const primeiro = await criarLeilao();
    const segundo = await criarLeilao();
    const r = await api('GET', '/leiloes');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.corpo)).toBe(true);
    const ids = r.corpo.map((l: any) => l.id);
    expect(ids).toContain(primeiro.id);
    expect(ids).toContain(segundo.id);
    expect(ids.indexOf(primeiro.id)).toBeLessThan(ids.indexOf(segundo.id));
  });
});
