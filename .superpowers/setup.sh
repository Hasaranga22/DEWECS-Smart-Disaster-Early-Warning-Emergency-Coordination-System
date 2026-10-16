#!/usr/bin/env bash
set -euo pipefail
S="/mnt/c/Users/USER/.cache/opencode/packages/superpowers@git+https_/github.com/obra/superpowers.git/node_modules/superpowers/skills"
REPO="/mnt/c/Users/USER/Desktop/All/3y 2s/css/assiment/Asimrnt 2 project/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System"
PLAN="$REPO/.superpowers/uc4-implementation-plan.md"
DIR=$(bash "$S/subagent-driven-development/scripts/sdd-workspace" "$PLAN")
if [ ! -f "$DIR/progress.md" ]; then
  printf '# SDD ledger — plan: %s\n' "$PLAN" > "$DIR/progress.md"
fi
echo "workspace: $DIR"
echo "--- ledger so far ---"
cat "$DIR/progress.md"
