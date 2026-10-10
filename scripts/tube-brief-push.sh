#!/bin/sh
# Pushes the Tube Brief commit made by the 6am Cowork run.
# Runs on the Mac (launchd, 06:30) so it uses your own git credentials.
set -eu
cd "$(dirname "$0")/.."
LOG="$HOME/Library/Logs/tube-brief-push.log"
{
  echo "--- $(date '+%Y-%m-%d %H:%M:%S')"
  git fetch origin main
  git rebase --autostash origin/main
  git push origin HEAD:main
} >>"$LOG" 2>&1
