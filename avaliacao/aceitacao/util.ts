// Utilitários da suíte de aceitação (cliente HTTP, SSE e espera).
import { expect } from 'vitest';

export const BASE = (process.env.URL_ALVO || 'http://localhost:3000').replace(/\/$/, '');

export interface Resposta {
  status: number;
  corpo: any;
  texto: string;
  headers: Headers;
}

export async function api(metodo: string, caminho: string, corpo?: unknown): Promise<Resposta> {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(8000),
  });
  const texto = await r.text();
  let json: unknown;
  try {
    json = texto ? JSON.parse(texto) : undefined;
  } catch {
    json = undefined;
  }
  return { status: r.status, corpo: json, texto, headers: r.headers };
}

/** Nome único por teste (os testes rodam em paralelo contra o mesmo servidor). */
export const unico = (prefixo: string): string =>
  `${prefixo}-${Math.random().toString(36).slice(2, 9)}`;

export const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

export interface NovoLeilao {
  titulo?: unknown;
  lanceInicial?: unknown;
  incrementoMinimo?: unknown;
  duracaoSegundos?: unknown;
  prorrogacaoSegundos?: unknown;
}

export async function criarLeilao(dados: NovoLeilao = {}): Promise<any> {
  const r = await api('POST', '/leiloes', {
    titulo: unico('Item'),
    lanceInicial: 100,
    incrementoMinimo: 10,
    duracaoSegundos: 60,
    ...dados,
  });
  expect(r.status, `POST /leiloes deveria responder 201 (corpo: ${r.texto.slice(0, 200)})`).toBe(201);
  expect(r.corpo?.id, 'o leilão criado deveria ter "id"').toBeTruthy();
  return r.corpo;
}

export function lance(leilaoId: string, participante: string, valor: unknown): Promise<Resposta> {
  return api('POST', `/leiloes/${leilaoId}/lances`, { participante, valor });
}

export async function eventos(leilaoId: string): Promise<any[]> {
  const r = await api('GET', `/leiloes/${leilaoId}/eventos`);
  expect(r.status, 'GET /leiloes/:id/eventos deveria responder 200').toBe(200);
  expect(Array.isArray(r.corpo), 'o histórico deveria ser uma lista').toBe(true);
  return r.corpo;
}

export async function consultar(leilaoId: string): Promise<any> {
  const r = await api('GET', `/leiloes/${leilaoId}`);
  expect(r.status, 'GET /leiloes/:id deveria responder 200').toBe(200);
  return r.corpo;
}

/** Repete `consulta` até `condicao` ser verdadeira ou estourar o prazo; devolve o último valor. */
export async function esperarAte<T>(
  consulta: () => Promise<T>,
  condicao: (v: T) => boolean,
  prazoMs: number,
  intervaloMs = 50,
): Promise<T> {
  const limite = Date.now() + prazoMs;
  let ultimo = await consulta();
  while (!condicao(ultimo) && Date.now() < limite) {
    await esperar(intervaloMs);
    ultimo = await consulta();
  }
  return ultimo;
}

export interface LeituraSSE {
  status: number;
  contentType: string;
  eventos: any[];
  /** true se o servidor fechou a conexão; false se a leitura foi interrompida pelo prazo. */
  fechadaPeloServidor: boolean;
  /** Mensagens cujo campo data não era JSON válido. */
  invalidas: string[];
}

/**
 * Abre um stream SSE. `conectado` resolve quando os cabeçalhos chegam;
 * `resultado` resolve quando o servidor fecha o stream ou o prazo acaba.
 */
export function abrirSSE(caminho: string, prazoMs: number) {
  const controle = new AbortController();
  let avisarConectado!: () => void;
  const conectado = new Promise<void>((r) => (avisarConectado = r));
  const leitura: LeituraSSE = {
    status: 0,
    contentType: '',
    eventos: [],
    fechadaPeloServidor: false,
    invalidas: [],
  };
  const prazo = setTimeout(() => controle.abort(), prazoMs);

  const resultado = (async (): Promise<LeituraSSE> => {
    try {
      const r = await fetch(BASE + caminho, {
        headers: { accept: 'text/event-stream' },
        signal: controle.signal,
      });
      leitura.status = r.status;
      leitura.contentType = r.headers.get('content-type') ?? '';
      avisarConectado();
      if (!r.body) return leitura;
      const leitor = r.body.getReader();
      const decodificador = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) {
          leitura.fechadaPeloServidor = true;
          break;
        }
        buffer += decodificador.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let fim: number;
        while ((fim = buffer.indexOf('\n\n')) >= 0) {
          const bloco = buffer.slice(0, fim);
          buffer = buffer.slice(fim + 2);
          const dados = bloco
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).replace(/^ /, ''))
            .join('\n');
          if (!dados) continue;
          try {
            leitura.eventos.push(JSON.parse(dados));
          } catch {
            leitura.invalidas.push(dados);
          }
        }
      }
    } catch {
      // abortado pelo prazo ou conexão recusada
    } finally {
      clearTimeout(prazo);
      avisarConectado();
    }
    return leitura;
  })();

  return { conectado, resultado, fechar: () => controle.abort() };
}

export const tipos = (lista: any[]): string[] => lista.map((e) => e?.tipo);
