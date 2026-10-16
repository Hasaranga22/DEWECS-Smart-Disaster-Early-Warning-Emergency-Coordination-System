#!/usr/bin/env bash
set -euo pipefail
S="/mnt/c/Users/USER/.cache/opencode/packages/superpowers@git+https_/github.com/obra/superpowers.git/node_modules/superpowers/skills"
PLAN="/mnt/c/Users/USER/Desktop/All/3y 2s/css/assiment/Asimrnt 2 project/DEWECS-Smart-Disaster-Early-Warning-Emergency-Coordination-System/.superpowers/uc4-implementation-plan.md"
exec bash "$S/executing-plans/scripts/task-done" "$PLAN" "$@"
