import { describe, expect, test } from 'vitest';
import { ISO_UTC, api, criarLeilao, eventos, lance, tipos, unico } from './util.js';

describe('Histórico de eventos', () => {
  test('registra os eventos em ordem, com sequencia 1..n e dados corretos', async () => {
    const titulo = unico('Relógio');
    const l = await criarLeilao({
      titulo,
      lanceInicial: 100,
      incrementoMinimo: 10,
      duracaoSegundos: 60,
      prorrogacaoSegundos: 5,
    });
    const ana = unico('ana');
    const bia = unico('bia');
    await lance(l.id, ana, 90); // rejeitado: abaixo do mínimo
    await lance(l.id, ana, 100); // aceito
    await lance(l.id, ana, 200); // rejeitado: já lidera
    await lance(l.id, bia, 110); // aceito

    const lista = await eventos(l.id);
    expect(tipos(lista)).toEqual([
      'LeilaoCriado',
      'LanceRejeitado',
      'LanceAceito',
      'LanceRejeitado',
      'LanceAceito',
    ]);
    lista.forEach((e, i) => {
      expect(e.sequencia).toBe(i + 1);
      expect(e.leilaoId).toBe(l.id);
      expect(e.ocorridoEm).toMatch(ISO_UTC);
    });
    expect(lista[0].dados).toEqual({
      titulo,
      lanceInicial: 100,
      incrementoMinimo: 10,
      prorrogacaoSegundos: 5,
      encerraEm: l.encerraEm,
    });
    expect(lista[1].dados).toEqual({ participante: ana, valor: 90, motivo: 'VALOR_ABAIXO_DO_MINIMO' });
    expect(lista[2].dados).toEqual({ participante: ana, valor: 100 });
    expect(lista[3].dados).toEqual({ participante: ana, valor: 200, motivo: 'PARTICIPANTE_JA_LIDERA' });
    expect(lista[4].dados).toEqual({ participante: bia, valor: 110 });
  });

  test('respostas 400 e 404 não geram eventos', async () => {
    const l = await criarLeilao();
    await api('POST', `/leiloes/${l.id}/lances`, { participante: '', valor: 100 });
    await api('POST', `/leiloes/${l.id}/lances`, { participante: 'ana', valor: -1 });
    const lista = await eventos(l.id);
    expect(tipos(lista)).toEqual(['LeilaoCriado']);
  });

  test('histórico de leilão inexistente responde 404', async () => {
    const r = await api('GET', `/leiloes/${unico('nao-existe')}/eventos`);
    expect(r.status).toBe(404);
  });
});
