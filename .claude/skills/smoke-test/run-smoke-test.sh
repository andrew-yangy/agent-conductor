#!/usr/bin/env bash
# run-smoke-test.sh — Pipeline E2E smoke test runner
#
# Creates a trivial test directive, spawns a real /directive session,
# polls directive.json for step progression, validates each step via
# validate-gate.sh, and reports pass/fail per pipeline step.
#
# Usage: bash .claude/skills/smoke-test/run-smoke-test.sh [weight]
#   weight: lightweight | medium (default: medium)
#
# Requires: jq, git, npx/tsx
# Compatibility: bash 3.2+ (macOS default)
#
# Exit: 0 if all steps pass, 1 if any fail or timeout

set -uo pipefail
# Note: set -e intentionally omitted — it interferes with background process
# management and signal propagation in bash. Errors are handled explicitly.

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT="$(git rev-parse --show-toplevel)"
TIMESTAMP="$(date +%s)"
DIRECTIVE_ID="smoke-test-${TIMESTAMP}"
BRANCH_NAME="directive/${DIRECTIVE_ID}"
WORKTREE_PATH="/tmp/smoke-test-${TIMESTAMP}"
DIRECTIVE_DIR="${WORKTREE_PATH}/.context/directives/${DIRECTIVE_ID}"
POLL_INTERVAL=10          # seconds between directive.json polls
TIMEOUT_SECONDS=900       # 15-minute overall timeout
START_TIME="$(date +%s)"
VALIDATE_GATE="${REPO_ROOT}/.claude/hooks/validate-gate.sh"
SPAWN_AGENT="${REPO_ROOT}/scripts/spawn-agent.ts"

# ---------------------------------------------------------------------------
# Weight argument
# ---------------------------------------------------------------------------

WEIGHT="${1:-medium}"

if [[ "$WEIGHT" != "lightweight" && "$WEIGHT" != "medium" ]]; then
  echo "ERROR: Invalid weight '${WEIGHT}'. Must be 'lightweight' or 'medium'."
  exit 1
fi

# Pipeline steps in order (15 steps, from SKILL.md)
# Using indexed arrays for bash 3.2 compatibility (no associative arrays)
STEP_NAMES=(
  triage
  checkpoint
  read
  context
  audit
  brainstorm
  clarification
  plan
  approve
  project-brainstorm
  setup
  execute
  review-gate
  wrapup
  completion
)
STEP_COUNT=${#STEP_NAMES[@]}

# Parallel arrays for tracking results per step (indexed same as STEP_NAMES)
# Values: pending | active | completed | skipped | failed | timeout
STEP_STATUS=()
STEP_GATE=()
STEP_EVIDENCE=()

for (( i=0; i<STEP_COUNT; i++ )); do
  STEP_STATUS+=("pending")
  STEP_GATE+=("--")
  STEP_EVIDENCE+=("")
done

# Track the spawned agent PID for cleanup
AGENT_PID=""

# ---------------------------------------------------------------------------
# Cleanup trap — runs on EXIT (success, failure, or signal)
# ---------------------------------------------------------------------------

cleanup() {
  local exit_code=$?
  echo ""
  echo "=== Cleanup ==="

  # Kill the spawned agent if still running
  if [[ -n "$AGENT_PID" ]] && kill -0 "$AGENT_PID" 2>/dev/null; then
    echo "Killing agent process (PID: ${AGENT_PID})..."
    kill "$AGENT_PID" 2>/dev/null || true
    # Also kill any child processes spawned by the agent
    pkill -P "$AGENT_PID" 2>/dev/null || true
  fi

  # Remove the worktree (--force handles dirty working tree)
  if [[ -d "$WORKTREE_PATH" ]]; then
    echo "Removing worktree at ${WORKTREE_PATH}..."
    git worktree remove --force "$WORKTREE_PATH" 2>/dev/null || true
    # If git worktree remove failed, clean up the directory manually
    if [[ -d "$WORKTREE_PATH" ]]; then
      rm -rf "$WORKTREE_PATH"
      # Prune stale worktree metadata
      git worktree prune 2>/dev/null || true
    fi
  fi

  # Delete test branch (now safe since worktree is gone)
  if git rev-parse --verify "$BRANCH_NAME" >/dev/null 2>&1; then
    echo "Deleting test branch ${BRANCH_NAME}..."
    git branch -D "$BRANCH_NAME" 2>/dev/null || true
  fi

  # Clean up temp files (keep logs on failure for debugging)
  rm -f "/tmp/smoke-test-pid-${TIMESTAMP}.txt"
  if [[ "$exit_code" -eq 0 ]]; then
    rm -f "/tmp/smoke-test-err-${TIMESTAMP}.log"
    rm -f "/tmp/smoke-test-${TIMESTAMP}.log"
  else
    echo "Logs preserved at /tmp/smoke-test-${TIMESTAMP}.log and /tmp/smoke-test-err-${TIMESTAMP}.log"
  fi

  echo "Cleanup complete."
  exit "$exit_code"
}

trap cleanup EXIT

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

elapsed() {
  local now
  now="$(date +%s)"
  echo $(( now - START_TIME ))
}

is_timed_out() {
  [[ $(elapsed) -ge $TIMEOUT_SECONDS ]]
}

log() {
  local secs
  secs="$(elapsed)"
  local mins=$(( secs / 60 ))
  local rem=$(( secs % 60 ))
  printf "[%dm%02ds] %s\n" "$mins" "$rem" "$1"
}

# Get the index of a step name in STEP_NAMES, or -1 if not found
step_index() {
  local name="$1"
  for (( i=0; i<STEP_COUNT; i++ )); do
    if [[ "${STEP_NAMES[$i]}" == "$name" ]]; then
      echo "$i"
      return
    fi
  done
  echo "-1"
}

# Read a field from directive.json using jq
read_directive_field() {
  local field="$1"
  if [[ -f "${DIRECTIVE_DIR}/directive.json" ]]; then
    jq -r "${field} // empty" "${DIRECTIVE_DIR}/directive.json" 2>/dev/null || echo ""
  else
    echo ""
  fi
}

# Get the status of a specific pipeline step from directive.json
get_step_status_from_json() {
  local step="$1"
  read_directive_field ".pipeline.\"${step}\".status"
}

# Check if a step is in the skip set for the current weight
# Both lightweight and medium skip brainstorm.
# Clarification and approve auto-approve (they run, not skipped).
is_weight_skip() {
  local step="$1"
  case "$WEIGHT" in
    lightweight) [[ "$step" == "brainstorm" ]] ;;
    medium)      [[ "$step" == "brainstorm" ]] ;;
  esac
}

# Run validate-gate.sh for a given step and return PASS or FAIL: reason
# NOTE: Known race condition — validate-gate.sh does a read-modify-write on
# directive.json (adding gates.{step}), while the spawned /directive agent
# may concurrently write to the same file. The gate entries are informational
# metadata that the agent does not read, so a lost write is acceptable.
run_gate_validation() {
  local step="$1"
  local result
  result="$(bash "$VALIDATE_GATE" "$DIRECTIVE_DIR" "$step" 2>/dev/null)" || \
    result='{"valid":false,"violations":[{"rule":"error","message":"validate-gate.sh failed to execute"}]}'

  local valid
  valid="$(echo "$result" | jq -r '.valid' 2>/dev/null)" || valid="false"

  if [[ "$valid" == "true" ]]; then
    echo "PASS"
  else
    local violation_msgs
    violation_msgs="$(echo "$result" | jq -r '[.violations[].message] | join("; ")' 2>/dev/null)" || violation_msgs="unknown"
    echo "FAIL: ${violation_msgs}"
  fi
}

# ---------------------------------------------------------------------------
# Step 1: Create isolated worktree
# ---------------------------------------------------------------------------

log "Creating worktree at ${WORKTREE_PATH} on branch ${BRANCH_NAME}"
git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME" 2>/dev/null || {
  log "ERROR: Failed to create worktree at ${WORKTREE_PATH}"
  exit 1
}
log "Worktree created (user's branch unchanged)"

# ---------------------------------------------------------------------------
# Step 2: Create test directive inside the worktree
# ---------------------------------------------------------------------------

log "Creating test directive: ${DIRECTIVE_ID}"

mkdir -p "$DIRECTIVE_DIR"

# Create directive.md — weight-specific task
if [[ "$WEIGHT" == "lightweight" ]]; then
  cat > "${DIRECTIVE_DIR}/directive.md" << 'DIRECTIVE_MD'
# Smoke Test Directive (Lightweight)

## Problem
This is an automated smoke test of the lightweight pipeline. No real problem to solve.

## What I Want
Create a marker file at `.context/smoke-test-marker.txt` with content `smoke-test-verified`.

This is a trivial, single-file creation that exercises every pipeline step at lightweight weight.

## Success Looks Like
- The marker file exists at `.context/smoke-test-marker.txt`
- Its content is exactly `smoke-test-verified`
- All pipeline steps execute in order
- No errors or missing artifacts
DIRECTIVE_MD
else
  cat > "${DIRECTIVE_DIR}/directive.md" << 'DIRECTIVE_MD'
# Smoke Test Directive (Medium)

## Problem
This is an automated smoke test of the medium pipeline. No real problem to solve.

## What I Want
Create a utility module at `scripts/smoke-test-util.ts` with:
- A function `verifyPipeline()` that returns `{ verified: true, timestamp: Date.now() }`
- A config object `SMOKE_TEST_CONFIG = { timeout: 300, pollInterval: 10 }`

This is a moderate task that creates a module with a function and config, exercising every pipeline step at medium weight.

## Success Looks Like
- The file `scripts/smoke-test-util.ts` exists with the function and config
- All pipeline steps execute in order
- No errors or missing artifacts
DIRECTIVE_MD
fi

# Create directive.json — weight from argument, test_mode enabled
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TODAY="$(date +"%Y-%m-%d")"

cat > "${DIRECTIVE_DIR}/directive.json" << DIRECTIVE_JSON
{
  "id": "${DIRECTIVE_ID}",
  "title": "Smoke Test -- Pipeline Verification",
  "status": "pending",
  "created": "${TODAY}",
  "completed": null,
  "weight": "${WEIGHT}",
  "test_mode": true,
  "produced_features": [],
  "report": null,
  "backlog_sources": [],
  "revision": 0,
  "intent_version": { "version": 1, "reason": null, "updated_at": null },
  "iterations": [],
  "started_at": "${NOW}",
  "updated_at": "${NOW}",
  "current_step": "triage",
  "pipeline": {},
  "projects": [],
  "planning": {
    "coo_plan": {},
    "ceo_approval": { "status": null, "modifications": [] },
    "worktree_path": null
  },
  "wrapup": {
    "follow_ups_processed": false,
    "digest_path": null,
    "lessons_updated": false
  }
}
DIRECTIVE_JSON

log "Test directive created at ${DIRECTIVE_DIR}"

# ---------------------------------------------------------------------------
# Step 3: Spawn the /directive session
# ---------------------------------------------------------------------------

log "Spawning /directive session for ${DIRECTIVE_ID}..."

# Spawn claude directly (bypassing spawn-agent.ts for reliability)
OUTPUT_LOG="/tmp/smoke-test-${TIMESTAMP}.log"
ERR_LOG="/tmp/smoke-test-err-${TIMESTAMP}.log"

# Unset CLAUDECODE to allow nested session (Claude Code checks env var existence)
# Use nohup to prevent signal propagation from parent shell
cd "$WORKTREE_PATH"
unset CLAUDECODE
nohup claude -p \
  --model sonnet \
  --dangerously-skip-permissions \
  --no-session-persistence \
  "/directive ${DIRECTIVE_ID}" \
  > "$OUTPUT_LOG" 2>"$ERR_LOG" < /dev/null &
AGENT_PID=$!
cd "$REPO_ROOT"

if [[ -z "$AGENT_PID" || "$AGENT_PID" == "0" ]]; then
  log "ERROR: Failed to spawn agent -- no PID returned"
  exit 1
fi

log "Agent spawned (PID: ${AGENT_PID})"

# ---------------------------------------------------------------------------
# Step 4: Poll directive.json for step progression
# ---------------------------------------------------------------------------

log "Polling directive.json every ${POLL_INTERVAL}s (timeout: ${TIMEOUT_SECONDS}s)..."
echo ""

LAST_REPORTED_STEP=""

while true; do
  # Check timeout
  if is_timed_out; then
    log "TIMEOUT: Pipeline did not complete within ${TIMEOUT_SECONDS}s"
    # Record remaining steps as timeout
    for (( i=0; i<STEP_COUNT; i++ )); do
      if [[ "${STEP_STATUS[$i]}" == "pending" || "${STEP_STATUS[$i]}" == "active" ]]; then
        STEP_STATUS[$i]="timeout"
        STEP_GATE[$i]="N/A"
        STEP_EVIDENCE[$i]="Timed out after ${TIMEOUT_SECONDS}s"
      fi
    done
    break
  fi

  # Check if agent is still running (first check before reading state)
  AGENT_ALIVE=true
  if [[ -n "$AGENT_PID" ]] && ! kill -0 "$AGENT_PID" 2>/dev/null; then
    AGENT_ALIVE=false
    # Give it a moment -- directive.json might have a final update pending
    sleep 2
  fi

  # Read current state from directive.json
  if [[ ! -f "${DIRECTIVE_DIR}/directive.json" ]]; then
    sleep "$POLL_INTERVAL"
    continue
  fi

  # Scan all steps for status updates
  for (( i=0; i<STEP_COUNT; i++ )); do
    step="${STEP_NAMES[$i]}"
    json_status="$(get_step_status_from_json "$step")"

    case "$json_status" in
      completed)
        if [[ "${STEP_STATUS[$i]}" != "completed" ]]; then
          STEP_STATUS[$i]="completed"

          # Validate gate for the NEXT step (validate-gate checks prerequisites)
          # For the last step (completion), validate the completion gate itself
          next_idx=$(( i + 1 ))
          if [[ $next_idx -lt $STEP_COUNT ]]; then
            next_step="${STEP_NAMES[$next_idx]}"
            gate_result="$(run_gate_validation "$next_step")"
          else
            gate_result="$(run_gate_validation "completion")"
          fi

          STEP_GATE[$i]="$gate_result"

          # Extract evidence from pipeline output
          output_summary="$(read_directive_field ".pipeline.\"${step}\".output.summary")"

          # Annotate auto-approved steps with weight-based reason
          # clarification and approve auto-approve for lightweight and medium weights
          if [[ "$step" == "clarification" || "$step" == "approve" ]]; then
            if [[ "$WEIGHT" == "lightweight" || "$WEIGHT" == "medium" ]]; then
              auto_note="Auto-approved (${WEIGHT} weight)"
              if [[ -n "$output_summary" ]]; then
                STEP_EVIDENCE[$i]="${auto_note} -- ${output_summary}"
              else
                STEP_EVIDENCE[$i]="$auto_note"
              fi
            else
              STEP_EVIDENCE[$i]="${output_summary:-no output summary}"
            fi
          else
            STEP_EVIDENCE[$i]="${output_summary:-no output summary}"
          fi

          log "COMPLETED: ${step} | Gate: ${gate_result}"
        fi
        ;;
      skipped)
        if [[ "${STEP_STATUS[$i]}" != "skipped" ]]; then
          STEP_STATUS[$i]="skipped"
          if is_weight_skip "$step"; then
            STEP_GATE[$i]="SKIP"
            STEP_EVIDENCE[$i]="Skipped (${WEIGHT} skip set: step not run)"
          else
            STEP_GATE[$i]="SKIP"
            STEP_EVIDENCE[$i]="Skipped (pipeline decision)"
          fi
          log "SKIPPED: ${step}"
        fi
        ;;
      active)
        if [[ "${STEP_STATUS[$i]}" != "active" && "${STEP_STATUS[$i]}" != "completed" && "${STEP_STATUS[$i]}" != "skipped" ]]; then
          STEP_STATUS[$i]="active"
          if [[ "$step" != "$LAST_REPORTED_STEP" ]]; then
            log "ACTIVE: ${step}"
            LAST_REPORTED_STEP="$step"
          fi
        fi
        ;;
      failed)
        if [[ "${STEP_STATUS[$i]}" != "failed" ]]; then
          STEP_STATUS[$i]="failed"
          output_summary="$(read_directive_field ".pipeline.\"${step}\".output.summary")"
          STEP_GATE[$i]="FAIL"
          STEP_EVIDENCE[$i]="${output_summary:-step failed}"
          log "FAILED: ${step}"
        fi
        ;;
      # pending or empty -- no action
    esac
  done

  # Check if directive status is completed (NOT awaiting_completion — that means
  # the completion gate is still running; test_mode will auto-approve shortly)
  directive_status="$(read_directive_field ".status")"
  if [[ "$directive_status" == "completed" ]]; then
    completion_idx="$(step_index "completion")"
    if [[ "$completion_idx" -ge 0 ]]; then
      if [[ "${STEP_STATUS[$completion_idx]}" == "pending" || "${STEP_STATUS[$completion_idx]}" == "active" ]]; then
        STEP_STATUS[$completion_idx]="completed"
        STEP_GATE[$completion_idx]="PASS"
        STEP_EVIDENCE[$completion_idx]="test_mode auto-approved"
      fi
    fi
    log "Directive status: completed"
    break
  fi

  # Check if agent died and no more progress
  if [[ "$AGENT_ALIVE" == "false" ]]; then
    log "Agent process exited and directive not completed (status: ${directive_status:-unknown})"
    for (( i=0; i<STEP_COUNT; i++ )); do
      if [[ "${STEP_STATUS[$i]}" == "pending" || "${STEP_STATUS[$i]}" == "active" ]]; then
        STEP_STATUS[$i]="failed"
        STEP_GATE[$i]="FAIL"
        STEP_EVIDENCE[$i]="Agent exited before this step ran"
      fi
    done
    break
  fi

  sleep "$POLL_INTERVAL"
done

# ---------------------------------------------------------------------------
# Step 5: Print results table
# ---------------------------------------------------------------------------

echo ""
echo "============================================================"
echo "  SMOKE TEST RESULTS"
echo "============================================================"
echo ""

DURATION="$(elapsed)"
DURATION_MIN=$(( DURATION / 60 ))
DURATION_SEC=$(( DURATION % 60 ))

echo "Directive:  ${DIRECTIVE_ID}"
echo "Weight:     ${WEIGHT}"
echo "Duration:   ${DURATION_MIN}m ${DURATION_SEC}s"
echo ""

# Determine overall result
OVERALL="PASS"
HAS_FAILURE=false

for (( i=0; i<STEP_COUNT; i++ )); do
  status="${STEP_STATUS[$i]}"
  gate="${STEP_GATE[$i]}"

  if [[ "$status" == "failed" || "$status" == "timeout" ]]; then
    OVERALL="FAIL"
    HAS_FAILURE=true
  fi

  # Gate failures also count (unless step was skipped)
  if [[ "$gate" == FAIL* && "$status" != "skipped" ]]; then
    OVERALL="FAIL"
    HAS_FAILURE=true
  fi
done

echo "Result:     ${OVERALL}"
echo ""

# Print table header
printf "%-3s %-20s %-12s %-8s %s\n" "#" "Step" "Status" "Gate" "Evidence"
printf "%-3s %-20s %-12s %-8s %s\n" "---" "--------------------" "------------" "--------" "----------------------------------------"

for (( i=0; i<STEP_COUNT; i++ )); do
  step="${STEP_NAMES[$i]}"
  status="${STEP_STATUS[$i]}"
  gate="${STEP_GATE[$i]}"
  evidence="${STEP_EVIDENCE[$i]}"

  # Truncate evidence to 60 chars for the table
  if [[ ${#evidence} -gt 60 ]]; then
    evidence="${evidence:0:57}..."
  fi

  printf "%-3s %-20s %-12s %-8s %s\n" "$(( i + 1 ))" "$step" "$status" "$gate" "$evidence"
done

echo ""

# Print failures in detail if any
if [[ "$HAS_FAILURE" == "true" ]]; then
  echo "--- FAILURES ---"
  echo ""
  for (( i=0; i<STEP_COUNT; i++ )); do
    step="${STEP_NAMES[$i]}"
    status="${STEP_STATUS[$i]}"
    gate="${STEP_GATE[$i]}"
    evidence="${STEP_EVIDENCE[$i]}"

    if [[ "$status" == "failed" || "$status" == "timeout" ]]; then
      echo "  ${step}:"
      echo "    Status:   ${status}"
      echo "    Gate:     ${gate}"
      echo "    Evidence: ${evidence}"
      echo ""
    elif [[ "$gate" == FAIL* && "$status" != "skipped" ]]; then
      echo "  ${step}:"
      echo "    Status:   ${status}"
      echo "    Gate:     ${gate}"
      echo "    Evidence: ${evidence}"
      echo ""
    fi
  done
fi

echo "============================================================"

# Exit with appropriate code
if [[ "$OVERALL" == "PASS" ]]; then
  exit 0
else
  exit 1
fi
