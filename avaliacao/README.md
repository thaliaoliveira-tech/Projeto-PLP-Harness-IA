# Kit de avaliação (oculto dos agentes)

> Não copie nada desta pasta para as pastas das execuções e não mostre estes arquivos ao agente.

Documentação completa: [`docs/06-instrumento-de-avaliacao.md`](../docs/06-instrumento-de-avaliacao.md).

| Caminho | O que é |
|---|---|
| `avaliar.mjs` | avalia um projeto: `node avaliacao/avaliar.mjs --projeto <dir> --saida <dir>` |
| `aceitacao/` | suíte de aceitação (41 testes caixa-preta via HTTP); roda com `URL_ALVO=http://host:porta npx vitest run` |
| `verificador/` | casos de teste do verificador de regras (`npm run test:verificador`) |
| `referencia/` | gabarito: implementação reativa de referência (camada sobre a base) |
| `anti-gabarito/` | implementação imperativa equivalente (camada sobre a base) |

O verificador de regras em si fica em `projetos/harness/scripts/verificar-reatividade.mjs` (fonte única,
usada pelo harness e pelo kit).
