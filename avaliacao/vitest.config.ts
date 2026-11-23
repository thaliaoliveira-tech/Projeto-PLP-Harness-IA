import { defineConfig } from 'vitest/config';

// Suíte de aceitação oculta: testes caixa-preta via HTTP contra um servidor já iniciado.
// O endereço vem de URL_ALVO (o avaliar.mjs sobe o servidor e preenche a variável).
export default defineConfig({
  test: {
    include: ['aceitacao/**/*.test.ts'],
    testTimeout: 20_000,
    // Cada teste cria seus próprios leilões/participantes, então podem rodar em paralelo.
    sequence: { concurrent: true },
    fileParallelism: true,
    reporters: ['default'],
  },
});
