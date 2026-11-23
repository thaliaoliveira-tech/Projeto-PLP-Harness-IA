import { describe, expect, test } from 'vitest';
import { abrirSSE, consultar, criarLeilao, esperar, esperarAte, eventos, lance, tipos, unico } from './util.js';

describe('Stream em tempo real (SSE)', () => {
  test('responde text/event-stream e envia o histórico já ocorrido ao conectar', async () => {
    const l = await criarLeilao();
    expect((await lance(l.id, unico('ana'), 100)).status).toBe(201);
    expect((await lance(l.id, unico('bia'), 105)).status).toBe(422);

    const sse = abrirSSE(`/leiloes/${l.id}/stream`, 1500);
    const leitura = await sse.resultado;
    expect(leitura.status).toBe(200);
    expect(leitura.contentType).toContain('text/event-stream');
    expect(leitura.invalidas, 'todas as mensagens deveriam ter JSON válido em data').toEqual([]);
    expect(leitura.eventos).toEqual(await eventos(l.id));
  });

  test('envia cada novo evento em tempo real para quem está conectado', async () => {
    const l = await criarLeilao();
    const sse = abrirSSE(`/leiloes/${l.id}/stream`, 2000);
    await sse.conectado;
    await esperar(150);
    const ana = unico('ana');
    expect((await lance(l.id, ana, 100)).status).toBe(201);
    expect((await lance(l.id, unico('bia'), 101)).status).toBe(422);
    const leitura = await sse.resultado;
    expect(tipos(leitura.eventos)).toEqual(['LeilaoCriado', 'LanceAceito', 'LanceRejeitado']);
    expect(leitura.eventos[1]).toMatchObject({ sequencia: 2, dados: { participante: ana, valor: 100 } });
  });

  test('finaliza o stream depois de enviar LeilaoEncerrado', async () => {
    const l = await criarLeilao({ duracaoSegundos: 1 });
    const sse = abrirSSE(`/leiloes/${l.id}/stream`, 4000);
    await sse.conectado;
    const leitura = await sse.resultado;
    expect(leitura.fechadaPeloServidor, 'o servidor deveria fechar o stream após o encerramento').toBe(true);
    expect(tipos(leitura.eventos)).toEqual(['LeilaoCriado', 'LeilaoEncerrado']);
  });

  test('leilão já encerrado: envia o histórico completo e fecha a conexão', async () => {
    const l = await criarLeilao({ duracaoSegundos: 1 });
    expect((await lance(l.id, unico('ana'), 100)).status).toBe(201);
    await esperarAte(
      () => consultar(l.id),
      (x) => x.status === 'ENCERRADO',
      Date.parse(l.encerraEm) - Date.now() + 1000,
    );
    const sse = abrirSSE(`/leiloes/${l.id}/stream`, 2000);
    const leitura = await sse.resultado;
    expect(leitura.fechadaPeloServidor).toBe(true);
    expect(tipos(leitura.eventos)).toEqual(['LeilaoCriado', 'LanceAceito', 'LeilaoEncerrado']);
  });
});
