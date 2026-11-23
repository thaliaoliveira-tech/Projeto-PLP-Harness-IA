import { describe, expect, test } from 'vitest';
import { consultar, criarLeilao, eventos, lance, unico } from './util.js';

describe('Consistência sob concorrência', () => {
  test('20 lances simultâneos: processados um a um, sem perder nem duplicar eventos', async () => {
    const l = await criarLeilao({ lanceInicial: 10, incrementoMinimo: 10, duracaoSegundos: 60 });
    const valores = Array.from({ length: 20 }, (_, i) => (i + 1) * 10); // 10, 20, ..., 200
    const respostas = await Promise.all(valores.map((v) => lance(l.id, unico(`p${v}`), v)));
    const aceitos = respostas.filter((r) => r.status === 201).length;
    expect(respostas.every((r) => r.status === 201 || r.status === 422)).toBe(true);

    const atual = await consultar(l.id);
    // Seja qual for a ordem de chegada, o lance de 200 nunca pode ser recusado.
    expect(atual.maiorLance?.valor).toBe(200);
    expect(atual.totalLances).toBe(aceitos);

    const lista = await eventos(l.id);
    expect(lista.map((e) => e.sequencia)).toEqual(lista.map((_, i) => i + 1));
    const deLance = lista.filter((e) => e.tipo === 'LanceAceito' || e.tipo === 'LanceRejeitado');
    expect(deLance).toHaveLength(20);
    expect(lista.filter((e) => e.tipo === 'LanceAceito')).toHaveLength(aceitos);
  });

  test('leilões são independentes entre si', async () => {
    const [a, b] = await Promise.all([criarLeilao(), criarLeilao()]);
    const ana = unico('ana');
    expect((await lance(a.id, ana, 100)).status).toBe(201);
    const [la, lb] = await Promise.all([consultar(a.id), consultar(b.id)]);
    expect(la.totalLances).toBe(1);
    expect(lb.totalLances).toBe(0);
    expect(lb.maiorLance).toBeNull();
    expect((await eventos(b.id)).map((e) => e.tipo)).toEqual(['LeilaoCriado']);
  });
});
