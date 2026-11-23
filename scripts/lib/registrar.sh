# Acrescenta uma linha ao registro local dos hooks/validações: .harness/hooks.log
registrar() {
  mkdir -p .harness
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >> .harness/hooks.log
}
