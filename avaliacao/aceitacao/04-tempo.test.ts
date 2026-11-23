import { describe, expect, test } from 'vitest';
import { consultar, criarLeilao, esperar, esperarAte, eventos, lance, tipos, unico } from './util.js';

const TOLERANCIA_MS = 1000; // a especificação pede até 500 ms; a suíte aceita o dobro

const encerrado = (l: any) => l?.status === 'ENCERRADO';

describe('Regras de tempo', () => {
  test('encerra sozinho ao atingir encerraEm, define o vencedor e emite LeilaoEncerrado por último', async () => {
    const l = await criarLeilao({ duracaoSegundos: 1, lanceInicial: 100, incrementoMinimo: 10 });
    const ana = unico('ana');
    expect((await lance(l.id, ana, 130)).status).toBe(201);

    const prazo = Date.parse(l.encerraEm) - Date.now() + TOLERANCIA_MS;
    const final = await esperarAte(() => consultar(l.id), encerrado, prazo);
    expect(final.status, 'o leilão deveria estar ENCERRADO até 1 s após encerraEm').toBe('ENCERRADO');
    expect(final.vencedor).toBe(ana);

    const lista = await eventos(l.id);
    expect(lista.at(-1)?.tipo).toBe('LeilaoEncerrado');
    expect(lista.at(-1)?.dados).toEqual({ vencedor: ana, valor: 130 });
  });

  test('leilão sem lances encerra com vencedor null', async () => {
    const l = await criarLeilao({ duracaoSegundos: 1 });
    const prazo = Date.parse(l.encerraEm) - Date.now() + TOLERANCIA_MS;
    const final = await esperarAte(() => consultar(l.id), encerrado, prazo);
    expect(final.status).toBe('ENCERRADO');
    expect(final.vencedor).toBeNull();
    const lista = await eventos(l.id);
    expect(tipos(lista)).toEqual(['LeilaoCriado', 'LeilaoEncerrado']);
    expect(lista[1].dados).toEqual({ vencedor: null, valor: null });
  });

  test('lance após o encerramento é recusado com 409 LEILAO_ENCERRADO e não gera evento', async () => {
    const l = await criarLeilao({ duracaoSegundos: 1 });
    const prazo = Date.parse(l.encerraEm) - Date.now() + TOLERANCIA_MS;
    await esperarAte(() => consultar(l.id), encerrado, prazo);
    const antes = await eventos(l.id);
    const r = await lance(l.id, unico('ana'), 1000);
    expect(r.status).toBe(409);
    expect(r.corpo).toEqual({ aceito: false, motivo: 'LEILAO_ENCERRADO' });
    const depois = await eventos(l.id);
    expect(depois).toEqual(antes);
    expect(depois.at(-1)?.tipo).toBe('LeilaoEncerrado');
  });

  test('lance aceito dentro da janela de prorrogação prorroga o leilão (anti-sniping)', async () => {
    const l = await criarLeilao({ duracaoSegundos: 2, prorrogacaoSegundos: 3 });
    const r = await lance(l.id, unico('ana'), 100); // faltam < 3 s: prorroga
    expect(r.status).toBe(201);

    const lista = await eventos(l.id);
    expect(tipos(lista)).toEqual(['LeilaoCriado', 'LanceAceito', 'LeilaoProrrogado']);
    const prorrogado = lista[2];
    expect(prorrogado.dados.encerraEmAnterior).toBe(l.encerraEm);
    const novoPrazo = Date.parse(prorrogado.dados.encerraEm);
    expect(novoPrazo - Date.parse(lista[1].ocorridoEm)).toBeGreaterThanOrEqual(3000 - 100);
    expect(novoPrazo - Date.parse(lista[1].ocorridoEm)).toBeLessThanOrEqual(3000 + 100);
    expect(r.corpo.leilao.encerraEm).toBe(prorrogado.dados.encerraEm);

    // Depois do prazo original o leilão ainda deve estar aberto...
    await esperar(Math.max(0, Date.parse(l.encerraEm) - Date.now()) + 400);
    expect((await consultar(l.id)).status).toBe('ABERTO');
    // ...e deve encerrar no novo prazo.
    const final = await esperarAte(
      () => consultar(l.id),
      encerrado,
      novoPrazo - Date.now() + TOLERANCIA_MS,
    );
    expect(final.status).toBe('ENCERRADO');
  });

  test('lance aceito fora da janela de prorrogação não prorroga', async () => {
    const l = await criarLeilao({ duracaoSegundos: 30, prorrogacaoSegundos: 2 });
    expect((await lance(l.id, unico('ana'), 100)).status).toBe(201);
    const lista = await eventos(l.id);
    expect(tipos(lista)).toEqual(['LeilaoCriado', 'LanceAceito']);
    expect((await consultar(l.id)).encerraEm).toBe(l.encerraEm);
  });

  test('com prorrogacaoSegundos = 0 nunca há prorrogação', async () => {
    const l = await criarLeilao({ duracaoSegundos: 1, prorrogacaoSegundos: 0 });
    expect((await lance(l.id, unico('ana'), 100)).status).toBe(201);
    const final = await esperarAte(
      () => consultar(l.id),
      encerrado,
      Date.parse(l.encerraEm) - Date.now() + TOLERANCIA_MS,
    );
    expect(final.status).toBe('ENCERRADO');
    expect(final.encerraEm).toBe(l.encerraEm);
    expect(tipos(await eventos(l.id))).toEqual(['LeilaoCriado', 'LanceAceito', 'LeilaoEncerrado']);
  });

  test('várias prorrogações seguidas reagendam o encerramento a cada vez', async () => {
    const l = await criarLeilao({ duracaoSegundos: 1, prorrogacaoSegundos: 2 });
    expect((await lance(l.id, unico('ana'), 100)).status).toBe(201);
    await esperar(700);
    expect((await lance(l.id, unico('bia'), 110)).status).toBe(201);

    const lista = await eventos(l.id);
    const prorrogacoes = lista.filter((e) => e.tipo === 'LeilaoProrrogado');
    expect(prorrogacoes).toHaveLength(2);
    expect(prorrogacoes[1].dados.encerraEmAnterior).toBe(prorrogacoes[0].dados.encerraEm);

    // O primeiro prazo prorrogado já passou, mas o segundo ainda não: deve seguir aberto.
    const primeiroPrazo = Date.parse(prorrogacoes[0].dados.encerraEm);
    await esperar(Math.max(0, primeiroPrazo - Date.now()) + 300);
    expect((await consultar(l.id)).status).toBe('ABERTO');

    const final = await esperarAte(
      () => consultar(l.id),
      encerrado,
      Date.parse(prorrogacoes[1].dados.encerraEm) - Date.now() + TOLERANCIA_MS,
    );
    expect(final.status).toBe('ENCERRADO');
  });
});
