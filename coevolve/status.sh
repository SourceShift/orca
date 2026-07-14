#!/usr/bin/env bash
# Status of the Co-Evolve stack.
#
# Lives in a script, not inline in the Makefile: embedding python (braces, quotes) in a
# Make recipe means fighting BOTH Make's $$ expansion and the shell's brace expansion.
# The first attempt printed the ContextNest line four times with unexpanded field names.
#
# Note to future self: inside python3 -c '...' the program is already single-quoted, so
# double quotes need NO backslash. Escaping them (\") is a SyntaxError that 2>/dev/null
# hides — which is how the first fix silently printed empty details.
#
# Probes by PORT, not process name — the port is the only thing the panel cares about.
set -uo pipefail

MINIORK_PORT="${MINIORK_PORT:-7090}"
CN_PORT="${CN_PORT:-28080}"
CONTEXTNEST="${CONTEXTNEST:-$HOME/ps/ContextNest}"
ORCA="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

G=$'\033[32m'; R=$'\033[31m'; D=$'\033[2m'; O=$'\033[0m'

fmt_miniork() {
  python3 -c '
import sys, json
d = json.load(sys.stdin)
out = "{:,} traces · {:,} gradients · {} arms · {}/{} promoted".format(
    d.get("traces", 0), d.get("gradients", 0), d.get("bandit_arms", 0),
    d.get("promoted", 0), d.get("promotions", 0))
brk = d.get("open_circuit_breakers", 0)
if brk:
    out += "  \033[31m{} BREAKER(S) OPEN\033[0m".format(brk)
print(out, end="")
'
}

fmt_cn() {
  python3 -c '
import sys, json
d = json.load(sys.stdin)
print("{:,} fragments · {:,} sessions".format(
    d.get("total_fragments", 0), d.get("total_sessions", 0)), end="")
'
}

echo "── Co-Evolve stack ──"

if curl -sf -m 2 "http://127.0.0.1:${MINIORK_PORT}/api/v1/health" >/dev/null 2>&1; then
  detail=$(curl -s -m 3 "http://127.0.0.1:${MINIORK_PORT}/api/v1/learning/summary" | fmt_miniork)
  printf '%s✓%s mini-ork    :%-6s %s\n' "$G" "$O" "$MINIORK_PORT" "$detail"
else
  printf '%s✗%s mini-ork    :%-6s down   %s(bin/mini-ork serve --port %s)%s\n' \
    "$R" "$O" "$MINIORK_PORT" "$D" "$MINIORK_PORT" "$O"
fi

if curl -sf -m 2 "http://127.0.0.1:${CN_PORT}/api/health" >/dev/null 2>&1; then
  detail=$(curl -s -m 3 "http://127.0.0.1:${CN_PORT}/api/v1/stats" | fmt_cn)
  printf '%s✓%s ContextNest :%-6s %s\n' "$G" "$O" "$CN_PORT" "$detail"
else
  printf '%s✗%s ContextNest :%-6s down   %s(cd %s && make dev-be)%s\n' \
    "$R" "$O" "$CN_PORT" "$D" "$CONTEXTNEST" "$O"
fi

seam=$(bash "$ORCA/coevolve/rebase.sh" --check 2>/dev/null | tail -1)
printf '  %s%s%s\n' "$D" "$seam" "$O"
