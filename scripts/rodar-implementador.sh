#!/usr/bin/env bash
# Dispara o agente IMPLEMENTADOR de uma execução: Claude Code não interativo, sessão própria,
# rodando dentro da pasta isolada da execução, com parâmetros fixos (experimento/config-implementador.env).
#
# Uso: scripts/rodar-implementador.sh <ID> <tipo>
#   inicial     -> envia experimento/prompts/tarefa.md (abre a sessão)
#   intervencao -> envia o intervencao.md do ÚLTIMO checkpoint (mesma sessão)
#   pergunta    -> envia a resposta padronizada a uma pergunta do agente (mesma sessão)
#   continuar   -> envia "Continue até concluir a tarefa." (mesma sessão)
#
# Salva em experimento/execucoes/<ID>/implementador/: rodada-NN-<tipo>.json (saída bruta),
# rodada-NN-<tipo>.prompt.md (o texto exato enviado), session-id e log.md.
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$RAIZ/scripts/lib/comum.sh"       # coloca o Node 24 no PATH (herdado pelo agente e pelos hooks)
source "$RAIZ/experimento/config-implementador.env"

ID="${1:-}"; TIPO="${2:-}"
DIR="$RAIZ/experimento/execucoes/$ID"
[ -f "$DIR/execucao.json" ] || { echo "erro: execução $ID não preparada" >&2; exit 1; }
campo() { node -e "const e=require(process.argv[1]); console.log(e[process.argv[2]] ?? '')" "$DIR/execucao.json" "$1"; }
[ "$(campo status)" = "em-andamento" ] || { echo "erro: execução $ID não está em andamento" >&2; exit 1; }
PASTA="$(campo pasta)"
[ -d "$PASTA" ] || { echo "erro: pasta $PASTA não existe" >&2; exit 1; }

IMP="$DIR/implementador"; mkdir -p "$IMP"
SESSAO="$IMP/session-id"
N=$(printf '%02d' "$(ls "$IMP"/rodada-*.json 2>/dev/null | wc -l)")
PROMPT_ARQ="$IMP/rodada-$N-$TIPO.prompt.md"

case "$TIPO" in
  inicial)
    [ -f "$SESSAO" ] && { echo "erro: a sessão de $ID já foi iniciada" >&2; exit 1; }
    cp "$RAIZ/experimento/prompts/tarefa.md" "$PROMPT_ARQ" ;;
  intervencao)
    [ -f "$SESSAO" ] || { echo "erro: sessão não iniciada" >&2; exit 1; }
    ULT="$(node -e "const e=require(process.argv[1]); const c=e.checkpoints.at(-1); console.log(c ? c.pasta : '')" "$DIR/execucao.json")"
    [ -n "$ULT" ] && [ -f "$DIR/$ULT/intervencao.md" ] || { echo "erro: o último checkpoint não tem intervencao.md (aprovado ou inexistente)" >&2; exit 1; }
    cp "$DIR/$ULT/intervencao.md" "$PROMPT_ARQ" ;;
  pergunta)
    [ -f "$SESSAO" ] || { echo "erro: sessão não iniciada" >&2; exit 1; }
    printf 'Siga a especificação da tarefa. O que não estiver especificado, decida você.\n' > "$PROMPT_ARQ" ;;
  continuar)
    [ -f "$SESSAO" ] || { echo "erro: sessão não iniciada" >&2; exit 1; }
    printf 'Continue até concluir a tarefa.\n' > "$PROMPT_ARQ" ;;
  *) echo "uso: $0 <ID> <inicial|intervencao|pergunta|continuar>" >&2; exit 2 ;;
esac

ARGS=(-p "$(cat "$PROMPT_ARQ")"
  --model "$MODELO" --effort "$ESFORCO"
  --permission-mode acceptEdits
  --allowedTools "Bash Read Edit Write Glob Grep"
  --disallowedTools "WebFetch WebSearch Agent Task Read(/$RAIZ/**)"
  --setting-sources project,local
  --output-format json)
[ "$TIPO" != "inicial" ] && ARGS+=(--resume "$(cat "$SESSAO")")

SAIDA="$IMP/rodada-$N-$TIPO.json"
INICIO=$(date +%s); QUANDO=$(date '+%d/%m/%Y %H:%M:%S')
echo "→ [$ID] rodada $N ($TIPO) com $MODELO/$ESFORCO em $PASTA — aguarde (pode levar dezenas de minutos)..."
set +e
(cd "$PASTA" && timeout "$LIMITE_SEGUNDOS" claude "${ARGS[@]}") > "$SAIDA" 2> "$IMP/rodada-$N-$TIPO.stderr"
CODIGO=$?
set -e
DURACAO=$(( $(date +%s) - INICIO ))

RESUMO="$(node -e '
const fs=require("fs"); let j={};
try { j=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); } catch { console.log("SAIDA_INVALIDA||||"); process.exit(0); }
const r=String(j.result??"").replace(/\s+/g," ").slice(0,300).replace(/\|/g,"/");
console.log([j.session_id??"", j.is_error?"erro":"ok", j.num_turns??"", (j.total_cost_usd??0).toFixed(2), r].join("|"));
' "$SAIDA")"
IFS='|' read -r SID STATUS TURNOS CUSTO TEXTO <<< "$RESUMO"
if [ "$TIPO" = "inicial" ] && [ -n "$SID" ]; then echo "$SID" > "$SESSAO"; fi

[ -f "$IMP/log.md" ] || printf '# Chamadas do implementador — %s\n\n| # | Quando | Tipo | Saída | Código | Duração (s) | Turnos | Custo (US$) | Início da resposta |\n|---|---|---|---|---|---|---|---|---|\n' "$ID" > "$IMP/log.md"
echo "| $N | $QUANDO | $TIPO | $STATUS | $CODIGO | $DURACAO | $TURNOS | $CUSTO | ${TEXTO:0:160} |" >> "$IMP/log.md"

echo "✔ rodada $N ($TIPO): código $CODIGO, $STATUS, ${DURACAO}s, $TURNOS turnos, US\$ $CUSTO"
echo "Resposta final do implementador (completa em $SAIDA, campo \"result\"):"
node -e 'try{const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(String(j.result??"(sem texto)"))}catch{console.log("(saída inválida — ver .stderr)")}' "$SAIDA"
[ "$CODIGO" -eq 0 ] || echo "⚠ o implementador terminou com código $CODIGO (124 = tempo esgotado). Ver $IMP/rodada-$N-$TIPO.stderr"
