// Testes de CONTRATO da API de leilões (parte do harness).
// Descrevem o comportamento essencial; não cobrem toda a especificação da tarefa.
// Não altere estes testes para fazê-los passar.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Api, esperar, lerSSE, requisitar, subirApi } from './apoio.js';

let api: Api;
const req = (metodo: string, caminho: string, corpo?: unknown) => requisitar(api.url, metodo, caminho, corpo);

const criar = async (extra: Record<string, unknown> = {}) => {
  const r = await req('POST', '/leiloes', {
    titulo: 'Bicicleta',
    lanceInicial: 100,
    incrementoMinimo: 10,
    duracaoSegundos: 60,
    ...extra,
  });
  expect(r.status).toBe(201);
  return r.corpo;
};

const esperarEncerramento = async (id: string, encerraEm: string) => {
  await esperar(Math.max(0, Date.parse(encerraEm) - Date.now()) + 700);
  return (await req('GET', `/leiloes/${id}`)).corpo;
};

beforeAll(async () => {
  api = await subirApi();
});

afterAll(async () => {
  await api?.app.close();
});

describe('contrato: leilões', () => {
  it('POST /leiloes cria um leilão aberto (201) no formato do recurso Leilao', async () => {
    const l = await criar({ prorrogacaoSegundos: 5 });
    expect(l).toEqual({
      id: expect.any(String),
      titulo: 'Bicicleta',
      lanceInicial: 100,
      incrementoMinimo: 10,
      prorrogacaoSegundos: 5,
      status: 'ABERTO',
      maiorLance: null,
      totalLances: 0,
      encerraEm: expect.any(String),
      vencedor: null,
    });
  });

  it('POST /leiloes com corpo inválido responde 400', async () => {
    const r = await req('POST', '/leiloes', { titulo: '', lanceInicial: 0, incrementoMinimo: 10, duracaoSegundos: 60 });
    expect(r.status).toBe(400);
  });

  it('GET /leiloes/:id de leilão inexistente responde 404', async () => {
    expect((await req('GET', '/leiloes/nao-existe')).status).toBe(404);
  });
});

describe('contrato: lances', () => {
  it('lance válido é aceito (201) e atualiza maiorLance e totalLances', async () => {
    const l = await criar();
    const r = await req('POST', `/leiloes/${l.id}/lances`, { participante: 'ana', valor: 100 });
    expect(r.status).toBe(201);
    expect(r.corpo.aceito).toBe(true);
    expect(r.corpo.leilao.maiorLance).toMatchObject({ participante: 'ana', valor: 100 });
    expect(r.corpo.leilao.totalLances).toBe(1);
  });

  it('lance abaixo do mínimo é recusado (422 VALOR_ABAIXO_DO_MINIMO) informando valorMinimo', async () => {
    const l = await criar();
    await req('POST', `/leiloes/${l.id}/lances`, { participante: 'ana', valor: 100 });
    const r = await req('POST', `/leiloes/${l.id}/lances`, { participante: 'bia', valor: 105 });
    expect(r.status).toBe(422);
    expect(r.corpo).toEqual({ aceito: false, motivo: 'VALOR_ABAIXO_DO_MINIMO', valorMinimo: 110 });
  });

  it('participante que já lidera é recusado (422 PARTICIPANTE_JA_LIDERA)', async () => {
    const l = await criar();
    await req('POST', `/leiloes/${l.id}/lances`, { participante: 'ana', valor: 100 });
    const r = await req('POST', `/leiloes/${l.id}/lances`, { participante: 'ana', valor: 200 });
    expect(r.status).toBe(422);
    expect(r.corpo).toEqual({ aceito: false, motivo: 'PARTICIPANTE_JA_LIDERA' });
  });
});

describe('contrato: eventos e tempo', () => {
  it('GET /leiloes/:id/eventos devolve o histórico em ordem com sequencia 1..n', async () => {
    const l = await criar();
    await req('POST', `/leiloes/${l.id}/lances`, { participante: 'ana', valor: 100 });
    await req('POST', `/leiloes/${l.id}/lances`, { participante: 'bia', valor: 50 });
    const r = await req('GET', `/leiloes/${l.id}/eventos`);
    expect(r.status).toBe(200);
    expect(r.corpo.map((e: any) => e.tipo)).toEqual(['LeilaoCriado', 'LanceAceito', 'LanceRejeitado']);
    expect(r.corpo.map((e: any) => e.sequencia)).toEqual([1, 2, 3]);
  });

  it('o leilão encerra sozinho no prazo, define o vencedor e emite LeilaoEncerrado', async () => {
    const l = await criar({ duracaoSegundos: 1 });
    await req('POST', `/leiloes/${l.id}/lances`, { participante: 'ana', valor: 100 });
    const final = await esperarEncerramento(l.id, l.encerraEm);
    expect(final.status).toBe('ENCERRADO');
    expect(final.vencedor).toBe('ana');
    const eventos = (await req('GET', `/leiloes/${l.id}/eventos`)).corpo;
    expect(eventos.at(-1)).toMatchObject({ tipo: 'LeilaoEncerrado', dados: { vencedor: 'ana', valor: 100 } });
  });

  it('lance em leilão encerrado é recusado (409 LEILAO_ENCERRADO)', async () => {
    const l = await criar({ duracaoSegundos: 1 });
    await esperarEncerramento(l.id, l.encerraEm);
    const r = await req('POST', `/leiloes/${l.id}/lances`, { participante: 'ana', valor: 100 });
    expect(r.status).toBe(409);
    expect(r.corpo).toEqual({ aceito: false, motivo: 'LEILAO_ENCERRADO' });
  });
});

describe('contrato: tempo real e notificações', () => {
  it('GET /leiloes/:id/stream (SSE) envia o histórico e fecha após LeilaoEncerrado', async () => {
    const l = await criar({ duracaoSegundos: 1 });
    await req('POST', `/leiloes/${l.id}/lances`, { participante: 'ana', valor: 100 });
    const sse = await lerSSE(`${api.url}/leiloes/${l.id}/stream`, 4000);
    expect(sse.status).toBe(200);
    expect(sse.tipo).toContain('text/event-stream');
    expect(sse.fechadoPeloServidor).toBe(true);
    expect(sse.eventos.map((e) => e.tipo)).toEqual(['LeilaoCriado', 'LanceAceito', 'LeilaoEncerrado']);
  });

  it('quem é superado recebe a notificação LANCE_SUPERADO', async () => {
    const l = await criar({ titulo: 'Relógio' });
    await req('POST', `/leiloes/${l.id}/lances`, { participante: 'carla', valor: 100 });
    await req('POST', `/leiloes/${l.id}/lances`, { participante: 'davi', valor: 130 });
    const r = await req('GET', '/participantes/carla/notificacoes');
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual([
      expect.objectContaining({
        tipo: 'LANCE_SUPERADO',
        leilaoId: l.id,
        titulo: 'Relógio',
        valorAnterior: 100,
        novoValor: 130,
      }),
    ]);
  });
});
