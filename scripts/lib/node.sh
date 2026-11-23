# Garante que o Node.js 24 esteja no PATH (shells não interativos às vezes não o têm).
if ! command -v node > /dev/null 2>&1; then
  for d in /usr/local/node-v24*/bin "$HOME"/.nvm/versions/node/v24*/bin "$HOME"/.volta/bin; do
    if [ -x "$d/node" ]; then export PATH="$d:$PATH"; break; fi
  done
fi
