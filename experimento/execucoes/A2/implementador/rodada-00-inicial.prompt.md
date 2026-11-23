# Tarefa: API de leilões em tempo real

Implemente, neste projeto NestJS, uma API HTTP de **leilões em tempo real** utilizando **programação reativa / orientada a eventos com RxJS**.

## Regras gerais

- Os dados ficam **apenas em memória** (não use banco de dados).
- O servidor deve funcionar com `npm run build` seguido de `npm run start:prod`, escutando na porta definida pela variável de ambiente `PORT` (padrão `3000`).
- Requisições e respostas usam JSON (exceto o stream SSE, descrito abaixo).
- Datas são strings ISO 8601 em UTC (ex.: `2026-11-23T13:00:00.000Z`).
- **Não faça commits no git**: o responsável pelo projeto fará os commits.

## Recurso `Leilao`

Sempre que a API devolver um leilão, ele deve ter exatamente este formato:

```json
{
  "id": "string única gerada pela API",
  "titulo": "Bicicleta aro 29",
  "lanceInicial": 100,
  "incrementoMinimo": 10,
  "prorrogacaoSegundos": 5,
  "status": "ABERTO",
  "maiorLance": { "participante": "ana", "valor": 150, "ocorridoEm": "2026-11-23T13:00:05.000Z" },
  "totalLances": 1,
  "encerraEm": "2026-11-23T13:01:00.000Z",
  "vencedor": null
}
```

| Campo | Descrição |
|---|---|
| `status` | `"ABERTO"` ou `"ENCERRADO"` |
| `maiorLance` | `null` enquanto não houver lance aceito |
| `totalLances` | quantidade de lances **aceitos** |
| `encerraEm` | instante de encerramento (pode mudar com a prorrogação) |
| `vencedor` | `null` enquanto aberto; após o encerramento, o participante do maior lance (ou `null` se não houve lances) |

## Endpoints

### 1. Criar leilão: `POST /leiloes`

Corpo:

```json
{ "titulo": "Bicicleta aro 29", "lanceInicial": 100, "incrementoMinimo": 10, "duracaoSegundos": 60, "prorrogacaoSegundos": 5 }
```

| Campo | Regra |
|---|---|
| `titulo` | string obrigatória, não vazia (desconsiderando espaços) |
| `lanceInicial` | número obrigatório, maior que zero |
| `incrementoMinimo` | número obrigatório, maior que zero |
| `duracaoSegundos` | inteiro obrigatório, de 1 a 86400 |
| `prorrogacaoSegundos` | inteiro opcional, de 0 a 3600 (padrão `0`) |

- Sucesso: **201** com o `Leilao` criado (`status` = `"ABERTO"`, `encerraEm` = agora + `duracaoSegundos`).
- Corpo inválido: **400**.

### 2. Listar leilões: `GET /leiloes`

**200** com a lista de todos os leilões, na ordem de criação.

### 3. Consultar leilão: `GET /leiloes/:id`

**200** com o `Leilao`, ou **404** se não existir.

### 4. Dar lance: `POST /leiloes/:id/lances`

Corpo:

```json
{ "participante": "ana", "valor": 150 }
```

Regras, verificadas **nesta ordem**:

1. Leilão inexistente: **404**.
2. Corpo inválido (`participante` deve ser string não vazia; `valor` deve ser número maior que zero): **400**.
3. Leilão encerrado (status `ENCERRADO` ou instante atual ≥ `encerraEm`): **409** com
   `{ "aceito": false, "motivo": "LEILAO_ENCERRADO" }`.
4. O participante já é o autor do maior lance: **422** com
   `{ "aceito": false, "motivo": "PARTICIPANTE_JA_LIDERA" }`.
5. Valor abaixo do mínimo: **422** com
   `{ "aceito": false, "motivo": "VALOR_ABAIXO_DO_MINIMO", "valorMinimo": 160 }`.
   O valor mínimo é `lanceInicial` quando ainda não há lances; depois, é `maiorLance.valor + incrementoMinimo`.
   Um lance **igual** ao mínimo é aceito.
6. Caso contrário o lance é aceito: **201** com `{ "aceito": true, "leilao": <Leilao atualizado> }`.

Lances simultâneos devem ser processados **um de cada vez, na ordem de chegada**, sem perder nem duplicar eventos.

### 5. Histórico de eventos: `GET /leiloes/:id/eventos`

**200** com a lista de eventos do leilão em ordem (ver "Eventos"), ou **404** se o leilão não existir.

### 6. Acompanhar em tempo real: `GET /leiloes/:id/stream`

Stream **Server-Sent Events** (`Content-Type: text/event-stream`).

- Ao conectar, o cliente recebe **todos os eventos já ocorridos** do leilão, em ordem, e depois **cada novo evento** assim que ele acontecer.
- Cada mensagem SSE tem no campo `data` o JSON do evento (mesmo formato do histórico).
- Depois de enviar o evento `LeilaoEncerrado`, o servidor **finaliza o stream** (fecha a conexão). Se o leilão já estiver encerrado ao conectar, o cliente recebe o histórico completo e a conexão é finalizada.

### 7. Notificações de um participante: `GET /participantes/:nome/notificacoes`

**200** com a lista de notificações do participante, em ordem cronológica (lista vazia se não houver).

| `tipo` | Quando | Campos |
|---|---|---|
| `LANCE_SUPERADO` | o participante tinha o maior lance de um leilão e **outro** participante teve um lance aceito nesse leilão | `tipo`, `leilaoId`, `titulo`, `valorAnterior` (lance do participante), `novoValor` (lance que o superou), `ocorridoEm` |
| `LEILAO_VENCIDO` | o leilão foi encerrado e o participante é o vencedor | `tipo`, `leilaoId`, `titulo`, `valor`, `ocorridoEm` |

## Regras de tempo

- **Encerramento automático:** quando o instante `encerraEm` é atingido, o leilão deve ser encerrado sozinho (sem precisar de nenhuma requisição), em até 500 ms: `status` passa a `ENCERRADO`, `vencedor` é definido e o evento `LeilaoEncerrado` é emitido.
- **Prorrogação (anti-sniping):** se um lance for aceito quando faltar **menos** de `prorrogacaoSegundos` para `encerraEm`, o leilão é prorrogado: `encerraEm` passa a ser *instante do lance + `prorrogacaoSegundos`* e o evento `LeilaoProrrogado` é emitido logo após o `LanceAceito`. Com `prorrogacaoSegundos` = 0 nunca há prorrogação. Pode haver várias prorrogações seguidas.

## Eventos

Todo evento tem o formato:

```json
{ "sequencia": 2, "tipo": "LanceAceito", "leilaoId": "…", "ocorridoEm": "2026-11-23T13:00:05.000Z", "dados": { "participante": "ana", "valor": 150 } }
```

- `sequencia` começa em 1 em cada leilão e aumenta de 1 em 1, sem buracos.
- `LeilaoEncerrado` é sempre o **último** evento de um leilão.

| `tipo` | Quando | `dados` |
|---|---|---|
| `LeilaoCriado` | leilão criado | `titulo`, `lanceInicial`, `incrementoMinimo`, `prorrogacaoSegundos`, `encerraEm` |
| `LanceAceito` | lance aceito | `participante`, `valor` |
| `LanceRejeitado` | lance recusado com **422** (motivos `PARTICIPANTE_JA_LIDERA` e `VALOR_ABAIXO_DO_MINIMO`) | `participante`, `valor`, `motivo` |
| `LeilaoProrrogado` | prorrogação | `encerraEmAnterior`, `encerraEm` |
| `LeilaoEncerrado` | encerramento | `vencedor` (ou `null`), `valor` (maior lance, ou `null`) |

Respostas 400, 404 e 409 **não** geram eventos.

## Exemplo de uso

```bash
curl -X POST localhost:3000/leiloes -H 'content-type: application/json' \
  -d '{"titulo":"Bicicleta","lanceInicial":100,"incrementoMinimo":10,"duracaoSegundos":30,"prorrogacaoSegundos":5}'
curl -N localhost:3000/leiloes/<id>/stream          # em outro terminal: acompanha em tempo real
curl -X POST localhost:3000/leiloes/<id>/lances -H 'content-type: application/json' -d '{"participante":"ana","valor":100}'
curl -X POST localhost:3000/leiloes/<id>/lances -H 'content-type: application/json' -d '{"participante":"bia","valor":110}'
curl localhost:3000/participantes/ana/notificacoes  # ana foi superada por bia
```

Ao terminar, responda com um resumo do que foi implementado e de como você verificou que funciona.
