#!/bin/sh
# Pushes commits made by the scheduled Cowork runs (Tube Brief daily, Journal sync weekly).
# Runs on the Mac via launchd (several times a day + at login) so it uses your own git credentials.
# Safe to run repeatedly: does nothing unless main is checked out, clean of in-progress git ops,
# and has commits that origin doesn't.
set -eu
cd "$(dirname "$0")/.."
LOG="$HOME/Library/Logs/tube-brief-push.log"
exec >>"$LOG" 2>&1
echo "--- $(date '+%Y-%m-%d %H:%M:%S')"

# The sandboxed commit can't always clean up after itself; clear stale locks (>10 min old).
find .git -maxdepth 2 -name '*.lock' -mmin +10 -delete
find .git/objects -name 'tmp_obj_*' -mmin +10 -delete

branch=$(git symbolic-ref --short -q HEAD || echo "")
if [ "$branch" != "main" ]; then
  echo "skip: on '$branch', not main"
  exit 0
fi
if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ] || [ -f .git/MERGE_HEAD ]; then
  echo "skip: rebase/merge in progress"
  exit 0
fi

git fetch origin main
if [ -z "$(git rev-list origin/main..main)" ]; then
  echo "nothing to push"
  exit 0
fi
git rebase --autostash origin/main
git push origin main
echo "pushed $(git rev-parse --short HEAD)"
