#!/usr/bin/env bash
# Global infrastructure must stay composable without any business feature:
# nothing under src/core/ or src/shared/ may import from src/features/.
#
# A feature that has to join the request pipeline implements the HttpExtension
# port (src/core/http/http-extension.ts) instead, and the composition root
# (src/app.module.ts) is the one place allowed to know both sides.
set -uo pipefail

readonly pattern="['\"][^'\"]*features/"
readonly roots=(src/core src/shared)

matches=$(grep -rnE "$pattern" "${roots[@]}")
status=$?

case "$status" in
  1)
    echo "OK: ${roots[*]} do not reference src/features"
    ;;
  0)
    {
      echo "Boundary violation: ${roots[*]} must not reference src/features."
      echo
      echo "$matches"
      echo
      echo "Move the shared piece to src/shared/, or expose it to core through"
      echo "a port such as src/core/http/http-extension.ts."
    } >&2
    exit 1
    ;;
  *)
    echo "grep exited with status $status: the boundary was NOT verified." >&2
    exit 1
    ;;
esac
