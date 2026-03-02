#!/bin/bash
# Agent Conductor — Scheduled Runs
#
# Run /scout and /report skills on a schedule using cron or launchd.
#
# Usage:
#   ./scripts/scheduled-runs.sh scout          # Run external intelligence gathering
#   ./scripts/scheduled-runs.sh report         # Run CEO daily report
#   ./scripts/scheduled-runs.sh report weekly  # Run CEO weekly report
#
# Cron examples (add with `crontab -e`):
#   # Daily scout at 8am
#   0 8 * * * /Users/yangyang/Repos/agent-conductor/scripts/scheduled-runs.sh scout
#
#   # Daily report at 6pm
#   0 18 * * * /Users/yangyang/Repos/agent-conductor/scripts/scheduled-runs.sh report
#
#   # Weekly report on Monday at 9am
#   0 9 * * 1 /Users/yangyang/Repos/agent-conductor/scripts/scheduled-runs.sh report weekly
#
# LaunchAgent setup (macOS):
#   See scripts/launchd/ for plist templates.
#   Copy to ~/Library/LaunchAgents/ and load with:
#   launchctl load ~/Library/LaunchAgents/com.agent-conductor.scout.plist

set -euo pipefail

SKILL="${1:-}"
MODE="${2:-daily}"
SW_DIR="/Users/yangyang/Repos/sw"
LOG_DIR="/Users/yangyang/Repos/agent-conductor/logs"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)

mkdir -p "$LOG_DIR"

if [ -z "$SKILL" ]; then
  echo "Usage: $0 <scout|report> [weekly]"
  exit 1
fi

case "$SKILL" in
  scout)
    echo "[$(date)] Running /scout..."
    cd "$SW_DIR"
    claude -p --dangerously-skip-permissions "/scout" \
      > "$LOG_DIR/scout-$TIMESTAMP.log" 2>&1
    echo "[$(date)] /scout complete. Log: $LOG_DIR/scout-$TIMESTAMP.log"
    ;;
  report)
    PROMPT="/report"
    if [ "$MODE" = "weekly" ]; then
      PROMPT="/report weekly"
    fi
    echo "[$(date)] Running $PROMPT..."
    cd "$SW_DIR"
    claude -p --dangerously-skip-permissions "$PROMPT" \
      > "$LOG_DIR/report-$MODE-$TIMESTAMP.log" 2>&1
    echo "[$(date)] $PROMPT complete. Log: $LOG_DIR/report-$MODE-$TIMESTAMP.log"
    ;;
  *)
    echo "Unknown skill: $SKILL"
    echo "Usage: $0 <scout|report> [weekly]"
    exit 1
    ;;
esac
