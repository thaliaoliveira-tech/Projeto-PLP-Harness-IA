# ROTEIRO DO CONDUTOR — execução completa do experimento A × B

> **Este arquivo é um prompt fechado.** Se você é um agente de IA e recebeu este arquivo, você é o
> **CONDUTOR** do experimento. Leia tudo antes de executar qualquer comando e siga os passos
> **na ordem, exatamente como escritos**. Quando algo não estiver previsto aqui, **pare, registre no
> log e pergunte ao usuário** — não improvise.

---

## 1. Contexto em 6 linhas

- Trabalho de faculdade: comparar um agente de IA implementando a **mesma** API (leilões em tempo real, NestJS + RxJS) **sem harness** (execuções A1, A2, A3) e **com harness** (B1, B2, B3).
- Métricas: **erros** (testes ocultos falhando), **violações arquiteturais** (regras RX01–RX09) e **intervenções humanas**.
- Toda a infraestrutura já existe e foi validada. Você **não constrói nada**: você **conduz** as 6 execuções com os scripts prontos, registra tudo e escreve os relatórios.
- Quem implementa o código **não é você**: é o **IMPLEMENTADOR**, uma sessão nova e isolada do Claude Code disparada por `scripts/rodar-implementador.sh` dentro da pasta da execução.
- Você é o "humano" do protocolo: o único feedback que o implementador recebe é o que os scripts geram.
- Raiz do repositório (todos os comandos partem daqui): `~/Documentos/workspace/Harness-agentes-IA`

---

## 2. Regras absolutas

### ✅ VOCÊ PODE

1. Rodar **somente** estes comandos do repositório:
   - `scripts/verificar-ambiente.sh`
   - `scripts/status-execucoes.sh`
   - `scripts/preparar-execucao.sh <ID>`
   - `scripts/rodar-implementador.sh <ID> <inicial|intervencao|pergunta|continuar>`
   - `scripts/checkpoint.sh <ID> <entrega|correcao>`
   - `scripts/finalizar-execucao.sh <ID>` (com `--motivo "..."` apenas nos casos da seção 7)
   - `node scripts/experimento.mjs prompt <ID>`
   - `node scripts/consolidar-resultados.mjs`
   - `scripts/gerar-historico-git.sh`
   - `git status`, `git log`, `git diff`, `git show`, `git add`, `git commit` (só no repositório principal)
2. **Ler** (para escrever logs e relatórios): `experimento/**`, `docs/**`, `README.md`, a saída dos scripts, e os ramos `execucoes/<ID>` via `git show`/`git diff`.
3. **Criar/editar** apenas: os arquivos de log e relatório definidos neste roteiro, o `registro.md` de cada execução e `docs/linha-do-tempo.md` (só acrescentar).

### ⛔ VOCÊ NÃO PODE

1. **Escrever, editar ou apagar código** na pasta de uma execução (`~/projetos-leilao/<ID>`) — nem para "ajudar". Nada de `checkpoint.sh <ID> humano`.
2. **Mandar ao implementador qualquer texto** que não seja gerado por `scripts/rodar-implementador.sh` (nada de dicas, explicações, "o erro está em...").
3. Abrir/ler `avaliacao/referencia/`, `avaliacao/anti-gabarito/` ou `avaliacao/aceitacao/` (gabarito e testes ocultos), nem copiar nada de `avaliacao/` ou `projetos/` para as pastas das execuções.
4. Alterar a infraestrutura: `projetos/`, `avaliacao/`, `scripts/`, `experimento/prompts/`, `experimento/config-implementador.env`, `experimento/protocolo.md`, este roteiro.
5. Mudar a ordem das execuções, pular execuções, repetir uma execução ou reaproveitar um ID.
6. Rodar `claude` diretamente (só através de `scripts/rodar-implementador.sh`).
7. Apagar ramos, tags, commits, `experimento/descartadas/` ou qualquer arquivo de resultado. Nunca use `git reset`, `git rebase`, `git push`, `--force`.
8. Alterar arquivos de configuração do usuário (`~/.bashrc`, `~/.claude/*`, `~/.local/bin`).
9. Interromper uma chamada do implementador antes do limite de tempo configurado.
10. "Arredondar" ou omitir resultados ruins. Registre tudo, inclusive falhas suas.

---

## 3. Arquivos que você vai produzir

| Arquivo | Quando | Conteúdo |
|---|---|---|
| `experimento/auditoria/log-condutor.md` | o tempo todo | **diário único do condutor**: toda ação, saída relevante e decisão, com data/hora (formato na seção 6) |
| `experimento/execucoes/<ID>/registro.md` | durante cada execução | o modelo já existe; preencha as tabelas e observações |
| `experimento/execucoes/<ID>/relatorio.md` | ao fim de cada execução | relatório da execução (modelo na seção 8) |
| `experimento/resultados/relatorio-final.md` | no fim de tudo | relatório comparativo (modelo na seção 9) |

Os scripts produzem o resto automaticamente (checkpoints, métricas, prompts de intervenção, transcrições, resumos, linha do tempo de cada execução).

---

## 4. Passo 0 — Verificação inicial (uma vez)

Execute e registre cada resultado no `log-condutor.md` (crie o arquivo com o cabeçalho da seção 6):

1. `git status` → deve estar limpo (exceto arquivos não rastreados irrelevantes). Se houver alterações rastreadas que você não fez: **pare e pergunte ao usuário**.
2. `scripts/status-execucoes.sh` → as 6 execuções devem estar "não iniciada". Se alguma estiver diferente: **pare e pergunte**.
3. `ls ~/projetos-leilao` → deve estar vazio ou não existir. Se houver pastas: **pare e pergunte**.
4. `scripts/verificar-ambiente.sh` → anote o resultado.
   - O item 1 ("Node visível para processos não interativos") pode aparecer como ✖: **é esperado e está contornado** — `rodar-implementador.sh` injeta o Node no PATH do implementador e dos hooks. Não corrija.
   - O item 6 (dependências do kit) precisa estar ✔. Se não estiver, rode `(cd avaliacao && npm ci)` e anote.
   - Qualquer outro ✖: **pare e pergunte**.
5. `cat experimento/config-implementador.env` → copie para o log o modelo e o esforço. Eles valem para as 6 execuções.
6. Commit: `git add experimento/auditoria && git commit -m "exp: início da condução (passo 0)"`.

---

## 5. Ciclo de UMA execução (repita para cada ID)

**Ordem obrigatória: A1 → B1 → B2 → A2 → A3 → B3.** Termine uma execução (inclusive o relatório) antes de começar a próxima.

### 5.1 Preparar

```bash
scripts/preparar-execucao.sh <ID>
```

Registre no log: horário, pasta criada, commit inicial. Abra `experimento/execucoes/<ID>/registro.md` e preencha a tabela de configuração:
versão = saída de `claude --version`; modelo/esforço = do `config-implementador.env`; modo de permissão = `acceptEdits (não interativo)`; conversa nova = sim; horário = agora.

### 5.2 Disparar o implementador (prompt inicial)

```bash
scripts/rodar-implementador.sh <ID> inicial
```

- A chamada pode demorar **dezenas de minutos**. Se a sua ferramenta de terminal tiver limite de tempo, rode em segundo plano e aguarde até o processo terminar. Não interrompa.
- Ao terminar, o script mostra a **resposta final do implementador**. Leia e classifique (seção 5.3).

### 5.3 Classificar a resposta do implementador

| A resposta final do implementador... | Ação |
|---|---|
| diz que concluiu / apresenta resumo do que fez | vá para 5.4 (checkpoint) |
| termina com uma **pergunta sobre requisitos** ou pede uma decisão | `scripts/rodar-implementador.sh <ID> pergunta` e volte a 5.3 |
| para no meio (ex.: "quer que eu continue?", "próximos passos seriam...") sem concluir | `scripts/rodar-implementador.sh <ID> continuar` e volte a 5.3 |
| o script reporta **código 124** (tempo esgotado) ou erro da CLI | registre e siga a seção 7 |

Na dúvida entre "concluiu" e "parou no meio", trate como **concluiu** e faça o checkpoint (o kit decide). Registre sua classificação e o motivo no log **sempre**.

### 5.4 Checkpoint

- Primeiro checkpoint da execução: `scripts/checkpoint.sh <ID> entrega`
- Depois de cada intervenção: `scripts/checkpoint.sh <ID> correcao`

O script faz commit do que o implementador produziu, roda o kit (~40 s) e diz o próximo passo. Registre no log o resumo da linha `✅/❌` (build, aceitação x/41, violações, erros de tipo).

| O checkpoint mostrou... | Ação |
|---|---|
| `✅ Critério de conclusão atingido` | vá para 5.6 |
| `✍ Intervenção N` | vá para 5.5 |
| `⏹ Limite de 8 rodadas` ou `⏹ Limite de 120 minutos` | vá para 5.6 |

### 5.5 Intervenção

```bash
scripts/rodar-implementador.sh <ID> intervencao
```

O script envia **exatamente** o `intervencao.md` gerado pelo último checkpoint, na mesma sessão do implementador. Você não escreve nada. Depois, volte para 5.3 (e o próximo checkpoint será `correcao`).

### 5.6 Finalizar

1. Complete o `registro.md` (seções "Ocorrências", "Observações sobre o comportamento do agente" e "Impressão geral"), com base no que você viu nas respostas, nos checkpoints e — nas execuções B — no que o implementador disse sobre a validação/hooks.
2. Rode:

   ```bash
   scripts/finalizar-execucao.sh <ID>
   ```

   (importa o histórico para o ramo `execucoes/<ID>`, copia as transcrições e o log dos hooks, gera `resumo.md`, apaga a pasta de trabalho e faz commit).
3. Faça a **auditoria de isolamento** e registre o resultado no log:

   ```bash
   grep -l "Harness-agentes-IA" experimento/execucoes/<ID>/sessao/*.jsonl
   ```

   Nenhum arquivo listado = isolamento ok. Atenção: a regra de bloqueio passada ao implementador (`Read(//home/.../Harness-agentes-IA/**)`) contém o caminho e pode aparecer na transcrição — isso **não** é ocorrência. Se listar algo, procure no arquivo o trecho (`grep -o ".\{120\}Harness-agentes-IA.\{120\}"`) e registre se o implementador **tentou ler** o repositório principal (isso é uma ocorrência grave: anote no relatório da execução; não refaça a execução).
4. Escreva `experimento/execucoes/<ID>/relatorio.md` (modelo na seção 8).
5. Commit:

   ```bash
   git add experimento/execucoes/<ID> experimento/auditoria docs/linha-do-tempo.md
   git commit -m "exp(<ID>): registro, auditoria e relatório da execução"
   ```

6. Só então passe para a próxima execução.

---

## 6. Formato do `experimento/auditoria/log-condutor.md`

Cabeçalho (crie no passo 0):

```markdown
# Log do condutor

Condutor: <seu nome/modelo>. Implementador: <MODELO>/<ESFORCO> (experimento/config-implementador.env).
Formato: uma entrada por ação. Decisões sempre com o motivo.
```

Cada entrada:

```markdown
### <DD/MM/AAAA HH:MM> — <ID ou GERAL> — <ação curta>
- Comando: `...`
- Resultado: <resumo objetivo da saída; números exatos>
- Decisão: <o que você decidiu fazer a seguir e POR QUÊ (cite a linha da tabela do roteiro aplicada)>
- Arquivos gerados: <caminhos>
```

Registre também: qualquer erro seu, qualquer comando que você rodou por engano, qualquer desvio deste roteiro (com justificativa) e qualquer dúvida levada ao usuário.

---

## 7. Exceções

| Situação | O que fazer |
|---|---|
| `rodar-implementador.sh` termina com código ≠ 0 **uma vez** (erro de rede, limite de uso, CLI) | registre; aguarde 5 min; repita **o mesmo** comando (mesmo tipo). Isso não conta como intervenção (o script registra a rodada; anote no log que foi repetição técnica). |
| Falha de novo, ou código 124 (tempo esgotado) | rode o checkpoint correspondente (`entrega` ou `correcao`) com o que existir e siga o fluxo normal. |
| Limite de uso da conta / custo inesperado | **pare** depois de finalizar o passo atual com segurança (sem deixar chamada pela metade) e pergunte ao usuário. |
| Um script do repositório falha com erro inesperado | **não corrija o script**. Registre a saída completa no log e pergunte ao usuário. |
| A execução precisa ser encerrada sem atingir o critério por motivo técnico | `scripts/finalizar-execucao.sh <ID> --motivo "<descrição>"` e explique no relatório. |
| O implementador diz que não conseguiu rodar `npm`/`node` | registre como ocorrência; siga o fluxo normal (o kit avalia o que existir). |

---

## 8. Modelo de `experimento/execucoes/<ID>/relatorio.md`

```markdown
# Relatório da execução <ID> (<sem harness | com harness>)

## Resumo
- Status final: <aprovada | limite-rodadas | limite-tempo | encerrada-manual>
- Primeira entrega: build <ok/falhou>, <x>/41 testes falhando, <y> violações (<regras>)
- Intervenções: <n> (prompts de correção: <a>; perguntas/continuar: <b>)
- Tempo: <min> · Custo do implementador: US$ <soma dos custos em implementador/log.md>

## Linha do tempo
<tabela: checkpoint / horário / build / testes falhando / violações / o que foi enviado em seguida>

## O que deu errado e como foi corrigido
<para cada checkpoint reprovado: quais testes/regras falharam (cite intervencao.md) e o que o
implementador mudou para corrigir (use `git diff` entre os commits do ramo execucoes/<ID>)>

## Comportamento do agente
<seguiu instruções? rodou testes/validação por conta própria? (nas B: usou npm run validate? os hooks
bloquearam? ver harness-hooks.log e resumo.md) arquitetura produzida: reativa, imperativa ou mista?>

## Auditoria
- Isolamento (grep da seção 5.6): <ok | ocorrência descrita>
- Desvios do roteiro: <nenhum | lista>

## Evidências
- Ramo: `execucoes/<ID>` (tags `entrega` e `final`)
- Checkpoints: `checkpoints/`
- Chamadas do implementador: `implementador/log.md`
- Resumo automático: `resumo.md`
```

---

## 9. Depois das 6 execuções

1. `scripts/status-execucoes.sh` → confirme as 6 finalizadas.
2. `node scripts/consolidar-resultados.mjs` → gera `experimento/resultados/` (CSV, tabelas, gráficos).
3. `scripts/gerar-historico-git.sh`.
4. Escreva `experimento/resultados/relatorio-final.md`:

   ```markdown
   # Relatório final — harness × sem harness

   ## Configuração
   <modelo/esforço do implementador, versão do Claude Code, datas, ordem executada>

   ## Resultados
   <copie as tabelas principais de resultados.md (por execução e comparação A × B)>
   <liste os gráficos de graficos/>

   ## Respostas às hipóteses
   - H1 (menos erros na 1ª entrega com harness): <sim/não/inconclusivo + números>
   - H2 (menos violações na 1ª entrega com harness): <...>
   - H3 (menos intervenções com harness): <...>

   ## O que o harness fez na prática
   <bloqueios do Stop, edições com violação, validações — tabela 4 de resultados.md — e exemplos>

   ## Erros mais comuns sem harness
   <regras RX mais violadas, testes que mais falharam, exemplos de trechos de código>

   ## Limitações e ocorrências
   <n=3, um modelo, ocorrências registradas no log do condutor, desvios>
   ```

   Escreva só o que os dados mostram. Não invente números; cite os arquivos de onde vieram.
5. Acrescente ao final de `docs/linha-do-tempo.md` uma entrada resumindo a condução (datas, 6 execuções, onde estão os resultados).
6. Commit final:

   ```bash
   git add experimento docs
   git commit -m "exp: resultados consolidados e relatório final"
   ```

7. Responda ao usuário com: as 6 execuções e seus status, a tabela A × B principal, as respostas a H1–H3, ocorrências/desvios e onde estão os arquivos.

---

## 10. Checklist de auditoria (o que será conferido depois)

Antes de declarar que terminou, confira você mesmo cada item:

- [ ] `experimento/auditoria/log-condutor.md` tem entrada para **toda** chamada de script, com decisões justificadas.
- [ ] Ordem executada: A1, B1, B2, A2, A3, B3 (horários no log e na linha do tempo).
- [ ] Cada execução tem `implementador/` (prompts exatos enviados + saídas brutas + `log.md`), `checkpoints/`, `sessao/`, `resumo.md`, `registro.md` preenchido e `relatorio.md`.
- [ ] Nenhum arquivo em `implementador/rodada-*.prompt.md` contém texto escrito por você (só tarefa, intervencao.md do kit, ou as duas respostas padronizadas).
- [ ] Nenhum commit `fix(humano)` nos ramos `execucoes/*` (`git log --format='%an %s' execucoes/<ID>`).
- [ ] `git status` limpo; nenhuma alteração em `projetos/`, `avaliacao/`, `scripts/`, `experimento/prompts/`, `experimento/config-implementador.env`.
- [ ] Auditoria de isolamento registrada para as 6 execuções.
- [ ] `experimento/resultados/` gerado e `relatorio-final.md` escrito com números conferidos contra `resultados.md`.
