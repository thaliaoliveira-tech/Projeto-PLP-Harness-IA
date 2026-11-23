// Apoio aos testes de contrato: sobe o AppModule em porta livre e oferece um cliente HTTP/SSE.
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';

export interface Api {
  app: INestApplication;
  url: string;
}

export async function subirApi(): Promise<Api> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, url: `http://127.0.0.1:${port}` };
}

export interface Resposta {
  status: number;
  corpo: any;
}

export async function requisitar(url: string, metodo: string, caminho: string, corpo?: unknown): Promise<Resposta> {
  const r = await fetch(url + caminho, {
    method: metodo,
    headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  let json: unknown;
  try {
    json = texto ? JSON.parse(texto) : undefined;
  } catch {
    json = texto;
  }
  return { status: r.status, corpo: json };
}

export const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Lê um stream SSE até o servidor fechar a conexão (ou até `prazoMs`). */
export async function lerSSE(
  url: string,
  prazoMs: number,
): Promise<{ status: number; tipo: string; eventos: any[]; fechadoPeloServidor: boolean }> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), prazoMs);
  const eventos: any[] = [];
  let fechadoPeloServidor = false;
  let status = 0;
  let tipo = '';
  try {
    const r = await fetch(url, { signal: controle.signal });
    status = r.status;
    tipo = r.headers.get('content-type') ?? '';
    const leitor = r.body!.getReader();
    const dec = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) {
        fechadoPeloServidor = true;
        break;
      }
      buffer += dec.decode(value, { stream: true });
      let fim: number;
      while ((fim = buffer.indexOf('\n\n')) >= 0) {
        const dados = buffer
          .slice(0, fim)
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('\n');
        buffer = buffer.slice(fim + 2);
        if (dados) eventos.push(JSON.parse(dados));
      }
    }
  } catch {
    // prazo esgotado
  } finally {
    clearTimeout(timer);
  }
  return { status, tipo, eventos, fechadoPeloServidor };
}
