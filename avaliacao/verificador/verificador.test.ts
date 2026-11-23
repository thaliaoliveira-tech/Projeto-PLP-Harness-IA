// Testes do próprio instrumento: cada pasta em fixtures/ tem um src/ mínimo e um
// esperado.json com a contagem de violações por regra (regras omitidas = 0).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
// @ts-expect-error módulo .mjs sem declaração de tipos
import { REGRAS, verificar } from '../../projetos/harness/scripts/verificar-reatividade.mjs';

const DIR = join(import.meta.dirname, 'fixtures');

describe('verificador de regras reativas', () => {
  for (const caso of readdirSync(DIR).sort()) {
    test(`fixture "${caso}"`, () => {
      const esperado = JSON.parse(readFileSync(join(DIR, caso, 'esperado.json'), 'utf8'));
      const r = verificar({ raiz: join(DIR, caso) });
      const obtido = Object.fromEntries(Object.keys(REGRAS).map((k) => [k, r.porRegra[k]]));
      const alvo = Object.fromEntries(Object.keys(REGRAS).map((k) => [k, esperado[k] ?? 0]));
      expect(obtido, JSON.stringify(r.violacoes.map((v: any) => `${v.regra} ${v.arquivo}:${v.linha} ${v.trecho}`), null, 1)).toEqual(alvo);
    });
  }
});
