#!/usr/bin/env bash
# Rebase onto upstream Orca and re-apply the Co-Evolve seam.
#
# The whole integration is 3 files / 17 lines (coevolve/patches/). Everything else
# lives in coevolve/, which upstream never touches, so a rebase is cheap by
# construction. This script makes it a single command and FAILS LOUDLY if a patch
# no longer applies — which is the only way we find out that upstream moved a seam.
#
#   bash coevolve/rebase.sh            # fetch + rebase + re-apply + verify
#   bash coevolve/rebase.sh --check    # verify only; change nothing
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
PATCHES=(coevolve/patches/*.patch)
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

# ── the seam must be intact: these are the ONLY files upstream shares with us ──
seam_files() { grep -hE '^\+\+\+ b/' "${PATCHES[@]}" | sed 's|^+++ b/||' | sort -u; }

if [ "$CHECK_ONLY" = 1 ]; then
  echo "── seam check ──"
  fail=0
  for f in $(seam_files); do
    if grep -q 'COEVOLVE SEAM' "$f" 2>/dev/null || grep -q '@coevolve' "$f" 2>/dev/null; then
      echo "  ✓ $f"
    else
      echo "  ✗ $f — seam MISSING (upstream overwrote it, or the patch never applied)"
      fail=1
    fi
  done
  [ "$fail" = 0 ] && echo "seam intact ($(cat "${PATCHES[@]}" | grep -c '^[+-][^+-]') lines across ${#PATCHES[@]} files)"
  exit "$fail"
fi

# ── 1. stash our seam edits so the rebase sees a clean vanilla tree ────────────
echo "── stashing seam edits ──"
git stash push -q -m "coevolve-seam" -- $(seam_files) 2>/dev/null || true

# ── 2. rebase onto upstream ───────────────────────────────────────────────────
echo "── fetching upstream ──"
git fetch upstream --quiet
BEHIND=$(git rev-list --count HEAD..upstream/main)
echo "   behind upstream by ${BEHIND} commits"
git rebase upstream/main

# ── 3. re-apply the seam ──────────────────────────────────────────────────────
echo "── re-applying the seam ──"
git stash pop -q 2>/dev/null || {
  echo "   stash pop conflicted — falling back to the patch series"
  for p in "${PATCHES[@]}"; do
    if git apply --check "$p" 2>/dev/null; then
      git apply "$p" && echo "   ✓ $(basename "$p")"
    else
      echo ""
      echo "   ✗ $(basename "$p") NO LONGER APPLIES."
      echo "     Upstream changed a seam file. This is the ONE case that needs a human."
      echo "     Fix: open the target, re-add the seam by hand, then regenerate:"
      echo "       git diff -- <file> > $p"
      echo ""
      exit 1
    fi
  done
}

# ── 4. verify ─────────────────────────────────────────────────────────────────
bash coevolve/rebase.sh --check
