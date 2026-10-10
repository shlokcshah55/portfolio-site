#!/bin/sh
# Pushes the Tube Brief commit made by the 6am Cowork run.
# Runs on the Mac (launchd, 06:30) so it uses your own git credentials.
set -eu
cd "$(dirname "$0")/.."
LOG="$HOME/Library/Logs/tube-brief-push.log"
{
  echo "--- $(date '+%Y-%m-%d %H:%M:%S')"
  # The sandboxed 6am commit can't always clean up after itself; clear stale locks (>10 min old).
  find .git -maxdepth 2 -name '*.lock' -mmin +10 -delete
  find .git/objects -name 'tmp_obj_*' -mmin +10 -delete
  git fetch origin main
  git rebase --autostash origin/main
  git push origin HEAD:main
} >>"$LOG" 2>&1
