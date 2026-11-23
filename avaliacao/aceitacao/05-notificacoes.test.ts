import { describe, expect, test } from 'vitest';
import { ISO_UTC, api, consultar, criarLeilao, esperarAte, lance, unico } from './util.js';

const notificacoes = async (nome: string): Promise<any[]> => {
  const r = await api('GET', `/participantes/${encodeURIComponent(nome)}/notificacoes`);
  expect(r.status, 'GET /participantes/:nome/notificacoes deveria responder 200').toBe(200);
  expect(Array.isArray(r.corpo), 'as notificações deveriam ser uma lista').toBe(true);
  return r.corpo;
};

describe('Notificações', () => {
  test('quem tinha o maior lance recebe LANCE_SUPERADO, em ordem cronológica', async () => {
    const titulo1 = unico('Quadro');
    const titulo2 = unico('Vaso');
    const l1 = await criarLeilao({ titulo: titulo1, lanceInicial: 100, incrementoMinimo: 10 });
    const l2 = await criarLeilao({ titulo: titulo2, lanceInicial: 50, incrementoMinimo: 5 });
    const ana = unico('ana');
    const bia = unico('bia');

    expect((await lance(l1.id, ana, 100)).status).toBe(201);
    expect((await lance(l1.id, bia, 120)).status).toBe(201); // ana superada no l1
    expect((await lance(l2.id, ana, 50)).status).toBe(201);
    expect((await lance(l2.id, bia, 70)).status).toBe(201); // ana superada no l2

    const lista = await notificacoes(ana);
    expect(lista).toEqual([
      {
        tipo: 'LANCE_SUPERADO',
        leilaoId: l1.id,
        titulo: titulo1,
        valorAnterior: 100,
        novoValor: 120,
        ocorridoEm: expect.stringMatching(ISO_UTC),
      },
      {
        tipo: 'LANCE_SUPERADO',
        leilaoId: l2.id,
        titulo: titulo2,
        valorAnterior: 50,
        novoValor: 70,
        ocorridoEm: expect.stringMatching(ISO_UTC),
      },
    ]);
    expect(await notificacoes(bia)).toEqual([]);
  });

  test('o vencedor recebe LEILAO_VENCIDO quando o leilão encerra', async () => {
    const titulo = unico('Livro');
    const l = await criarLeilao({ titulo, duracaoSegundos: 1, lanceInicial: 10, incrementoMinimo: 1 });
    const ana = unico('ana');
    const bia = unico('bia');
    expect((await lance(l.id, ana, 10)).status).toBe(201);
    expect((await lance(l.id, bia, 11)).status).toBe(201);

    await esperarAte(
      () => consultar(l.id),
      (x) => x.status === 'ENCERRADO',
      Date.parse(l.encerraEm) - Date.now() + 1000,
    );
    const lista = await esperarAte(
      () => notificacoes(bia),
      (n) => n.length > 0,
      500,
    );
    expect(lista).toEqual([
      {
        tipo: 'LEILAO_VENCIDO',
        leilaoId: l.id,
        titulo,
        valor: 11,
        ocorridoEm: expect.stringMatching(ISO_UTC),
      },
    ]);
    // ana só foi superada; não venceu.
    expect((await notificacoes(ana)).map((n) => n.tipo)).toEqual(['LANCE_SUPERADO']);
  });

  test('participante sem notificações recebe lista vazia (200)', async () => {
    expect(await notificacoes(unico('ninguem'))).toEqual([]);
  });
});
