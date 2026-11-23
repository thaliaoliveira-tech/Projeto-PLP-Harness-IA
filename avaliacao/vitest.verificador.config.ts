import { defineConfig } from 'vitest/config';

// Testes do verificador de regras reativas (o instrumento de medição de violações).
export default defineConfig({
  test: { include: ['verificador/**/*.test.ts'] },
});
