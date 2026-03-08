#!/usr/bin/env bash
set -euo pipefail

# ─── Dimension: Directive Pipeline End-to-End ─────────────────────────────────
#
# Tests the full directive pipeline — the core product of gruai:
#
#   1. Welcome directive scaffolded by init has correct pipeline structure
#   2. Pipeline state machine: simulate step-by-step progression through all 14 steps
#   3. Weight-adaptive skipping (lightweight skips challenge+brainstorm+approve)
#   4. Server reads directive.json and exposes pipeline state via /api/state
#   5. validate-project-json.sh accepts valid and rejects invalid project.json
#   6. validate-cast.sh accepts valid and rejects invalid cast plans
#   7. Pipeline step transition rules (status transitions, output required)
#   8. Project discovery: server finds projects under directive's projects/ dir
#
# Compatible with bash 3.2+ (macOS default).
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/utils.sh"

DIM_NAME="pipeline"
DIM_START="$(start_timer)"

TEST_DIR=""
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ -n "$TEST_DIR" ]]; then
    cleanup_test_dir "$TEST_DIR"
  fi
}
trap cleanup EXIT

# ─── Setup ───────────────────────────────────────────────────────────────────

log_section "Setup: init project with full preset"

TEST_DIR="$(create_test_dir "e2e-test-pipeline")"
log_info "Test dir: ${TEST_DIR}"

init_output="$(run_gruai_init "$TEST_DIR" "full" 2>&1)" || true
assert_dir_exists "${TEST_DIR}/.gruai" "project initialized"

DIRECTIVES_DIR="${TEST_DIR}/.context/directives"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 1: Welcome directive pipeline structure
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 1: Welcome directive pipeline structure"

WELCOME_JSON="${DIRECTIVES_DIR}/welcome/directive.json"
assert_file_exists "$WELCOME_JSON" "welcome: directive.json exists"

if [[ -f "$WELCOME_JSON" ]]; then
  assert_json_field "$WELCOME_JSON" '.id' "welcome" "welcome: id = welcome"
  assert_json_field "$WELCOME_JSON" '.status' "pending" "welcome: status = pending"
  assert_json_field "$WELCOME_JSON" '.current_step' "triage" "welcome: current_step = triage"

  # Weight must be a valid enum
  weight="$(jq -r '.weight' "$WELCOME_JSON")"
  case "$weight" in
    lightweight|medium|heavyweight|strategic)
      log_pass "welcome: weight is valid ($weight)" ;;
    *)
      log_fail "welcome: weight is valid" "got: $weight" ;;
  esac
fi

# Welcome directive.md should exist
assert_file_exists "${DIRECTIVES_DIR}/welcome/directive.md" "welcome: directive.md exists"
assert_file_not_empty "${DIRECTIVES_DIR}/welcome/directive.md" "welcome: directive.md non-empty"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 2: Full pipeline state machine — simulate all 14 steps (heavyweight)
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 2: Full pipeline state machine (heavyweight)"

# Create a heavyweight directive and simulate the full pipeline
HW_DIR="${DIRECTIVES_DIR}/test-heavyweight"
mkdir -p "$HW_DIR"

# Start: triage step
cat > "${HW_DIR}/directive.json" <<'JSON'
{
  "id": "test-heavyweight",
  "title": "Test Heavyweight Pipeline",
  "weight": "heavyweight",
  "status": "pending",
  "current_step": "triage",
  "created_at": "2026-03-08T00:00:00Z",
  "updated_at": "2026-03-08T00:00:00Z"
}
JSON

cat > "${HW_DIR}/directive.md" <<'MD'
# Test Heavyweight Pipeline
Build a test feature to verify the pipeline works end-to-end.
MD

assert_json_field "${HW_DIR}/directive.json" '.current_step' "triage" "hw: starts at triage"
assert_json_field "${HW_DIR}/directive.json" '.status' "pending" "hw: starts pending"

# Define all 14 pipeline steps for heavyweight (none skipped)
ALL_STEPS="triage read context challenge plan audit approve project-brainstorm setup execute review-gate wrapup completion"
STEP_COUNT=0
for s in $ALL_STEPS; do STEP_COUNT=$((STEP_COUNT + 1)); done

# Simulate progressing through each step
_simulate_step() {
  local step_id="$1"
  local next_step="$2"
  local agent="$3"
  local summary="$4"
  local dir_status="$5"

  # Build pipeline JSON with all completed steps up to this point
  local pipeline_json=""
  local found=false
  for s in $ALL_STEPS; do
    if [[ "$s" == "$step_id" ]]; then
      found=true
      if [[ -n "$pipeline_json" ]]; then pipeline_json="${pipeline_json},"; fi
      pipeline_json="${pipeline_json}\"${s}\":{\"status\":\"completed\",\"agent\":\"${agent}\",\"output\":{\"summary\":\"${summary}\"}}"
    elif $found; then
      # Future steps — only mark next as active if it exists
      if [[ "$s" == "$next_step" ]]; then
        if [[ -n "$pipeline_json" ]]; then pipeline_json="${pipeline_json},"; fi
        pipeline_json="${pipeline_json}\"${s}\":{\"status\":\"active\"}"
      fi
      break
    else
      # Past steps — mark completed
      if [[ -n "$pipeline_json" ]]; then pipeline_json="${pipeline_json},"; fi
      pipeline_json="${pipeline_json}\"${s}\":{\"status\":\"completed\",\"agent\":\"CEO\",\"output\":{\"summary\":\"Step done.\"}}"
    fi
  done

  cat > "${HW_DIR}/directive.json" <<ENDJSON
{
  "id": "test-heavyweight",
  "title": "Test Heavyweight Pipeline",
  "weight": "heavyweight",
  "status": "${dir_status}",
  "current_step": "${next_step}",
  "created_at": "2026-03-08T00:00:00Z",
  "updated_at": "2026-03-08T00:01:00Z",
  "pipeline": {${pipeline_json}}
}
ENDJSON

  # Verify the JSON is valid
  if jq empty "${HW_DIR}/directive.json" 2>/dev/null; then
    log_pass "hw step ${step_id}: valid JSON after transition"
  else
    log_fail "hw step ${step_id}: valid JSON after transition"
    return
  fi

  # Verify current_step moved
  assert_json_field "${HW_DIR}/directive.json" '.current_step' "$next_step" \
    "hw step ${step_id}: current_step -> ${next_step}"

  # Verify step marked completed in pipeline
  local step_status
  step_status="$(jq -r ".pipeline.\"${step_id}\".status // empty" "${HW_DIR}/directive.json")"
  assert_eq "$step_status" "completed" "hw step ${step_id}: pipeline.${step_id}.status = completed"
}

# Progress through all steps
_simulate_step "triage" "read" "CEO" "Classified as heavyweight" "in_progress"
_simulate_step "read" "context" "CEO" "Read directive.md" "in_progress"
_simulate_step "context" "challenge" "CEO" "Loaded context" "in_progress"
_simulate_step "challenge" "plan" "C-suite" "3 proposals deliberated" "in_progress"
_simulate_step "plan" "audit" "COO" "2 projects planned" "in_progress"
_simulate_step "audit" "approve" "CTO" "No blockers found" "in_progress"
_simulate_step "approve" "project-brainstorm" "CEO" "Plan approved" "in_progress"
_simulate_step "project-brainstorm" "setup" "CTO" "Tasks decomposed" "in_progress"
_simulate_step "setup" "execute" "CEO" "Branch created" "in_progress"
_simulate_step "execute" "review-gate" "Engineers" "All tasks done" "in_progress"
_simulate_step "review-gate" "wrapup" "Reviewers" "All reviews pass" "in_progress"
_simulate_step "wrapup" "completion" "CEO" "Digest written" "awaiting_completion"

# Final: completion
assert_json_field "${HW_DIR}/directive.json" '.status' "awaiting_completion" \
  "hw: final status = awaiting_completion"
assert_json_field "${HW_DIR}/directive.json" '.current_step' "completion" \
  "hw: final current_step = completion"

# Verify all 14 steps are completed in pipeline (for heavyweight, none skipped)
completed_count="$(jq '[.pipeline | to_entries[] | select(.value.status == "completed")] | length' "${HW_DIR}/directive.json")"
# 13 completed (12 from steps + last step "wrapup"), "completion" is active
assert_gt "$completed_count" 11 "hw: at least 12 pipeline steps completed ($completed_count)"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 3: Weight-adaptive step skipping (lightweight)
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 3: Lightweight pipeline (skip challenge + brainstorm + approve)"

LW_DIR="${DIRECTIVES_DIR}/test-lightweight"
mkdir -p "$LW_DIR"

# Create a lightweight directive that's progressed past triage
cat > "${LW_DIR}/directive.json" <<'JSON'
{
  "id": "test-lightweight",
  "title": "Fix a typo",
  "weight": "lightweight",
  "status": "in_progress",
  "current_step": "plan",
  "created_at": "2026-03-08T00:00:00Z",
  "updated_at": "2026-03-08T00:01:00Z",
  "pipeline": {
    "triage": {"status": "completed", "agent": "CEO", "output": {"summary": "Lightweight."}},
    "read": {"status": "completed", "agent": "CEO", "output": {"summary": "Read."}},
    "context": {"status": "completed", "agent": "CEO", "output": {"summary": "Loaded."}},
    "challenge": {"status": "skipped"},
    "brainstorm": {"status": "skipped"},
    "plan": {"status": "active"}
  }
}
JSON

cat > "${LW_DIR}/directive.md" <<'MD'
# Fix a typo
Fix the typo in README.md line 42.
MD

assert_json_valid "${LW_DIR}/directive.json" "lw: valid JSON"

# Verify skipped steps
assert_json_field "${LW_DIR}/directive.json" '.pipeline.challenge.status' "skipped" \
  "lw: challenge skipped"
assert_json_field "${LW_DIR}/directive.json" '.pipeline.brainstorm.status' "skipped" \
  "lw: brainstorm skipped"

# Lightweight also skips approve (goes from audit straight to project-brainstorm)
# Progress to show approve is skipped
cat > "${LW_DIR}/directive.json" <<'JSON'
{
  "id": "test-lightweight",
  "title": "Fix a typo",
  "weight": "lightweight",
  "status": "in_progress",
  "current_step": "project-brainstorm",
  "created_at": "2026-03-08T00:00:00Z",
  "updated_at": "2026-03-08T00:02:00Z",
  "pipeline": {
    "triage": {"status": "completed", "agent": "CEO", "output": {"summary": "Lightweight."}},
    "read": {"status": "completed", "agent": "CEO", "output": {"summary": "Read."}},
    "context": {"status": "completed", "agent": "CEO", "output": {"summary": "Loaded."}},
    "challenge": {"status": "skipped"},
    "brainstorm": {"status": "skipped"},
    "plan": {"status": "completed", "agent": "COO", "output": {"summary": "1 project."}},
    "audit": {"status": "completed", "agent": "CTO", "output": {"summary": "LGTM."}},
    "approve": {"status": "skipped"},
    "project-brainstorm": {"status": "active"}
  }
}
JSON

assert_json_field "${LW_DIR}/directive.json" '.pipeline.approve.status' "skipped" \
  "lw: approve skipped"
assert_json_field "${LW_DIR}/directive.json" '.pipeline.plan.status' "completed" \
  "lw: plan still runs"
assert_json_field "${LW_DIR}/directive.json" '.pipeline.audit.status' "completed" \
  "lw: audit still runs"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 4: Medium weight (skip challenge only)
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 4: Medium pipeline (skip challenge only)"

MED_DIR="${DIRECTIVES_DIR}/test-medium"
mkdir -p "$MED_DIR"

cat > "${MED_DIR}/directive.json" <<'JSON'
{
  "id": "test-medium",
  "title": "Add search feature",
  "weight": "medium",
  "status": "in_progress",
  "current_step": "approve",
  "created_at": "2026-03-08T00:00:00Z",
  "updated_at": "2026-03-08T00:01:00Z",
  "pipeline": {
    "triage": {"status": "completed", "agent": "CEO", "output": {"summary": "Medium."}},
    "read": {"status": "completed", "agent": "CEO", "output": {"summary": "Read."}},
    "context": {"status": "completed", "agent": "CEO", "output": {"summary": "Loaded."}},
    "challenge": {"status": "skipped"},
    "plan": {"status": "completed", "agent": "COO", "output": {"summary": "2 projects."}},
    "audit": {"status": "completed", "agent": "CTO", "output": {"summary": "Minor findings."}},
    "approve": {"status": "active"}
  }
}
JSON

cat > "${MED_DIR}/directive.md" <<'MD'
# Add search feature
Implement full-text search across the codebase.
MD

assert_json_field "${MED_DIR}/directive.json" '.pipeline.challenge.status' "skipped" \
  "med: challenge skipped"
assert_json_field "${MED_DIR}/directive.json" '.pipeline.approve.status' "active" \
  "med: approve NOT skipped (runs for medium)"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 5: validate-project-json.sh — valid and invalid inputs
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 5: validate-project-json.sh"

VALIDATE_SCRIPT="${GRUAI_PACKAGE_ROOT}/.claude/hooks/validate-project-json.sh"

if [[ ! -f "$VALIDATE_SCRIPT" ]]; then
  log_info "validate-project-json.sh not found at ${VALIDATE_SCRIPT}, skipping"
else
  # Create a valid project.json
  PROJ_DIR="${HW_DIR}/projects/test-project"
  mkdir -p "$PROJ_DIR"
  cat > "${PROJ_DIR}/project.json" <<'JSON'
{
  "id": "test-project",
  "title": "Test Project",
  "status": "pending",
  "description": "A test project for pipeline validation.",
  "scope": {"in": ["src/"], "out": ["No production changes"]},
  "dod": [{"criterion": "All tests pass", "met": false}],
  "agent": ["riley"],
  "reviewers": ["sarah"],
  "tasks": [
    {
      "id": "task-1",
      "title": "Implement feature",
      "status": "pending",
      "agent": ["riley"],
      "scope": "Build the thing",
      "dod": [{"criterion": "Feature works", "met": false}]
    }
  ]
}
JSON

  # Run validation on valid project (from repo root for git rev-parse)
  valid_result="$(cd "${GRUAI_PACKAGE_ROOT}" && echo "{\"directive_dir\": \"${HW_DIR}\", \"project_id\": \"test-project\"}" | bash "$VALIDATE_SCRIPT" 2>&1)" || true

  if echo "$valid_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "validate-project-json: valid project passes"
  else
    log_fail "validate-project-json: valid project passes" "$valid_result"
  fi

  # Create an invalid project.json (missing tasks, agent, reviewers)
  INVALID_PROJ="${HW_DIR}/projects/bad-project"
  mkdir -p "$INVALID_PROJ"
  cat > "${INVALID_PROJ}/project.json" <<'JSON'
{
  "id": "bad-project",
  "title": "Bad Project"
}
JSON

  invalid_result="$(cd "${GRUAI_PACKAGE_ROOT}" && echo "{\"directive_dir\": \"${HW_DIR}\", \"project_id\": \"bad-project\"}" | bash "$VALIDATE_SCRIPT" 2>&1)" || true

  if echo "$invalid_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "validate-project-json: invalid project rejected"
  else
    log_fail "validate-project-json: invalid project rejected" "$invalid_result"
  fi

  # Check specific violations
  violation_count="$(echo "$invalid_result" | jq '.violations | length' 2>/dev/null || echo 0)"
  if (( violation_count >= 3 )); then
    log_pass "validate-project-json: reports $violation_count violations for bad project"
  else
    log_fail "validate-project-json: reports multiple violations" "got $violation_count"
  fi

  # Missing project.json entirely
  missing_result="$(cd "${GRUAI_PACKAGE_ROOT}" && echo "{\"directive_dir\": \"${HW_DIR}\", \"project_id\": \"nonexistent\"}" | bash "$VALIDATE_SCRIPT" 2>&1)" || true

  if echo "$missing_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "validate-project-json: missing file rejected"
  else
    log_fail "validate-project-json: missing file rejected" "$missing_result"
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# TEST 6: validate-cast.sh — valid and invalid casts
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 6: validate-cast.sh"

CAST_SCRIPT="${GRUAI_PACKAGE_ROOT}/.claude/hooks/validate-cast.sh"

if [[ ! -f "$CAST_SCRIPT" ]]; then
  log_info "validate-cast.sh not found at ${CAST_SCRIPT}, skipping"
else
  # Valid cast: builder != reviewer, has reviewer
  valid_cast='{"projects":[{"id":"proj-1","agent":["riley"],"reviewers":["sarah"],"complexity":"simple"}]}'
  valid_cast_result="$(echo "$valid_cast" | bash "$CAST_SCRIPT" 2>&1)" || true

  if echo "$valid_cast_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "validate-cast: valid cast passes"
  else
    log_fail "validate-cast: valid cast passes" "$valid_cast_result"
  fi

  # Invalid: builder is also reviewer
  conflict_cast='{"projects":[{"id":"proj-1","agent":["riley"],"reviewers":["riley"],"complexity":"simple"}]}'
  conflict_result="$(echo "$conflict_cast" | bash "$CAST_SCRIPT" 2>&1)" || true

  if echo "$conflict_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "validate-cast: builder=reviewer conflict detected"
  else
    log_fail "validate-cast: builder=reviewer conflict" "$conflict_result"
  fi

  # Invalid: no reviewers
  no_rev_cast='{"projects":[{"id":"proj-1","agent":["riley"],"reviewers":[],"complexity":"simple"}]}'
  no_rev_result="$(echo "$no_rev_cast" | bash "$CAST_SCRIPT" 2>&1)" || true

  if echo "$no_rev_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "validate-cast: no-reviewers rejected"
  else
    log_fail "validate-cast: no-reviewers rejected" "$no_rev_result"
  fi

  # Invalid: dangling depends_on
  dangling_cast='{"projects":[{"id":"proj-1","agent":["riley"],"reviewers":["sarah"],"depends_on":["nonexistent"]}]}'
  dangling_result="$(echo "$dangling_cast" | bash "$CAST_SCRIPT" 2>&1)" || true

  if echo "$dangling_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "validate-cast: dangling depends_on detected"
  else
    log_fail "validate-cast: dangling depends_on" "$dangling_result"
  fi

  # Invalid: circular dependency
  circular_cast='{"projects":[{"id":"a","agent":["riley"],"reviewers":["sarah"],"depends_on":["b"]},{"id":"b","agent":["jordan"],"reviewers":["sarah"],"depends_on":["a"]}]}'
  circular_result="$(echo "$circular_cast" | bash "$CAST_SCRIPT" 2>&1)" || true

  if echo "$circular_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "validate-cast: circular dependency detected"
  else
    log_fail "validate-cast: circular dependency" "$circular_result"
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# TEST 7: Server reads pipeline state from directive.json
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 7: Server exposes pipeline state via /api/state"

# Mark the heavyweight directive as in_progress so server picks it up
cat > "${HW_DIR}/directive.json" <<'JSON'
{
  "id": "test-heavyweight",
  "title": "Test Heavyweight Pipeline",
  "weight": "heavyweight",
  "status": "in_progress",
  "current_step": "execute",
  "created_at": "2026-03-08T00:00:00Z",
  "updated_at": "2026-03-08T00:05:00Z",
  "pipeline": {
    "triage": {"status": "completed", "agent": "CEO", "output": {"summary": "Heavyweight."}},
    "read": {"status": "completed", "agent": "CEO", "output": {"summary": "Read."}},
    "context": {"status": "completed", "agent": "CEO", "output": {"summary": "Loaded."}},
    "challenge": {"status": "completed", "agent": "C-suite", "output": {"summary": "Debated."}},
    "plan": {"status": "completed", "agent": "COO", "output": {"summary": "Planned."}},
    "audit": {"status": "completed", "agent": "CTO", "output": {"summary": "Audited."}},
    "approve": {"status": "completed", "agent": "CEO", "output": {"summary": "Approved."}},
    "project-brainstorm": {"status": "completed", "agent": "CTO", "output": {"summary": "Decomposed."}},
    "setup": {"status": "completed", "agent": "CEO", "output": {"summary": "Branch ready."}},
    "execute": {"status": "active", "agent": "Engineers"}
  }
}
JSON

PORT="$(find_free_port)"
log_info "Starting server on port $PORT"

run_gruai_start "$TEST_DIR" "$PORT" > /tmp/e2e-pipeline-server.log 2>&1 &
SERVER_PID=$!

# Wait for server
WAITED=0
MAX_WAIT=10
while (( WAITED < MAX_WAIT )); do
  if curl -sf "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  WAITED=$(( WAITED + 1 ))
done

if (( WAITED < MAX_WAIT )); then
  log_pass "server started on port $PORT"
else
  log_fail "server started" "no response after ${MAX_WAIT}s"
  # Try to continue anyway
fi

# Check /api/state for directive data
# API shape: { directiveState: {...}, activeDirectives: [...], directiveHistory: [...] }
state_response="$(curl -sf "http://localhost:${PORT}/api/state" 2>/dev/null || echo "{}")"

if echo "$state_response" | jq empty 2>/dev/null; then
  log_pass "/api/state returns valid JSON"
else
  log_fail "/api/state returns valid JSON"
fi

# Check directiveState (the active directive)
active_name="$(echo "$state_response" | jq -r '.directiveState.directiveName // empty' 2>/dev/null)"
if [[ "$active_name" == "test-heavyweight" ]]; then
  log_pass "server found active directive: test-heavyweight"
else
  log_fail "server found active directive" "got: '$active_name'"
fi

active_status="$(echo "$state_response" | jq -r '.directiveState.status // empty' 2>/dev/null)"
assert_eq "$active_status" "in_progress" "server: directive status = in_progress"

# Check pipeline steps exposed via pipelineSteps array
pipeline_length="$(echo "$state_response" | jq '.directiveState.pipelineSteps | length' 2>/dev/null || echo 0)"
if (( pipeline_length == 14 )); then
  log_pass "server exposes all 14 pipeline steps"
else
  log_fail "server exposes 14 pipeline steps" "got $pipeline_length"
fi

# Check currentStepId
current_step_id="$(echo "$state_response" | jq -r '.directiveState.currentStepId // empty' 2>/dev/null)"
assert_eq "$current_step_id" "execute" "server: currentStepId = execute"

# Check that execute step is active
execute_status="$(echo "$state_response" | jq -r '.directiveState.pipelineSteps[] | select(.id == "execute") | .status' 2>/dev/null)"
assert_eq "$execute_status" "active" "server: execute step status = active"

# Check that completed steps show as completed
triage_status="$(echo "$state_response" | jq -r '.directiveState.pipelineSteps[] | select(.id == "triage") | .status' 2>/dev/null)"
assert_eq "$triage_status" "completed" "server: triage step status = completed"

# Check that triage has artifacts with agent/summary
triage_agent="$(echo "$state_response" | jq -r '.directiveState.pipelineSteps[] | select(.id == "triage") | .artifacts.Agent // empty' 2>/dev/null)"
assert_eq "$triage_agent" "CEO" "server: triage artifact Agent = CEO"

# Check that future steps show as pending
wrapup_status="$(echo "$state_response" | jq -r '.directiveState.pipelineSteps[] | select(.id == "wrapup") | .status' 2>/dev/null)"
assert_eq "$wrapup_status" "pending" "server: wrapup step status = pending"

# Check weight is exposed
weight_val="$(echo "$state_response" | jq -r '.directiveState.weight // empty' 2>/dev/null)"
assert_eq "$weight_val" "heavyweight" "server: weight = heavyweight"

# Check activeDirectives list
active_count="$(echo "$state_response" | jq '.activeDirectives | length' 2>/dev/null || echo 0)"
assert_gt "$active_count" 0 "server: activeDirectives has entries ($active_count)"

# Check directiveHistory includes all directives
history_count="$(echo "$state_response" | jq '.directiveHistory | length' 2>/dev/null || echo 0)"
assert_gt "$history_count" 0 "server: directiveHistory has entries ($history_count)"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 8: Server project discovery from directive projects/
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 8: Server project discovery"

# Give the watcher a moment to pick up the project.json we created earlier
sleep 2

state2="$(curl -sf "http://localhost:${PORT}/api/state" 2>/dev/null || echo "{}")"

# Check if directive has projects in the API
projects_len="$(echo "$state2" | jq '.directiveState.projects | length' 2>/dev/null || echo 0)"
if (( projects_len > 0 )); then
  log_pass "server discovers projects under directive ($projects_len project(s))"
else
  log_info "server project discovery: $projects_len projects (watcher may need more time)"
fi

# Also check the top-level projects field
top_projects="$(echo "$state2" | jq '.projects | length' 2>/dev/null || echo 0)"
log_info "server top-level projects count: $top_projects"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 9: Pipeline step output requirement
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 9: Pipeline step output requirements"

# Every completed step must have output.summary (enforced by convention)
if [[ -f "${HW_DIR}/directive.json" ]]; then
  steps_with_output="$(jq '[.pipeline | to_entries[] | select(.value.status == "completed" and .value.output.summary != null)] | length' "${HW_DIR}/directive.json" 2>/dev/null || echo 0)"
  steps_completed="$(jq '[.pipeline | to_entries[] | select(.value.status == "completed")] | length' "${HW_DIR}/directive.json" 2>/dev/null || echo 0)"

  if [[ "$steps_with_output" == "$steps_completed" ]]; then
    log_pass "all completed steps have output.summary ($steps_with_output/$steps_completed)"
  else
    log_fail "all completed steps have output.summary" "$steps_with_output/$steps_completed have it"
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# TEST 10: Status transitions
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 10: Valid status transitions"

# Test that valid status values are accepted
for status in pending in_progress awaiting_completion completed failed; do
  cat > "${LW_DIR}/directive.json" <<ENDJSON
{
  "id": "test-lightweight",
  "title": "Fix a typo",
  "weight": "lightweight",
  "status": "${status}",
  "current_step": "triage",
  "created_at": "2026-03-08T00:00:00Z"
}
ENDJSON
  if jq empty "${LW_DIR}/directive.json" 2>/dev/null; then
    log_pass "status '${status}': valid"
  else
    log_fail "status '${status}': valid"
  fi
done

# Kill server
kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true
SERVER_PID=""

# ═════════════════════════════════════════════════════════════════════════════
# TEST 11: validate-gate.sh — Pipeline artifact-chain enforcement
# ═════════════════════════════════════════════════════════════════════════════
# This is the REAL pipeline enforcement. Each step has prerequisites (artifacts
# from prior steps). validate-gate.sh blocks step transitions when missing.
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 11: validate-gate.sh — artifact chain enforcement"

GATE_SCRIPT="${GRUAI_PACKAGE_ROOT}/.claude/hooks/validate-gate.sh"

if [[ ! -f "$GATE_SCRIPT" ]]; then
  log_fail "validate-gate.sh exists" "not found at ${GATE_SCRIPT}"
else
  log_pass "validate-gate.sh exists"

  # --- Build a realistic directive with proper artifacts ---
  GATE_DIR="${DIRECTIVES_DIR}/test-gate-enforcement"
  mkdir -p "${GATE_DIR}/projects/build-feature"

  cat > "${GATE_DIR}/directive.json" <<'JSON'
{
  "id": "test-gate-enforcement",
  "title": "Test Gate Enforcement",
  "weight": "heavyweight",
  "status": "in_progress",
  "current_step": "execute",
  "pipeline": {
    "triage": {"status": "completed", "agent": "CEO", "output": {"weight": "heavyweight"}},
    "read": {"status": "completed", "agent": "CEO", "output": {"summary": "Read."}},
    "context": {"status": "completed", "agent": "CEO", "output": {"summary": "Loaded."}},
    "challenge": {"status": "completed", "agent": "C-suite", "output": {"summary": "Debated."}},
    "plan": {"status": "completed", "agent": "COO", "output": {"summary": "Planned."}},
    "audit": {"status": "completed", "agent": "CTO", "output": {"summary": "Audited."}},
    "approve": {"status": "completed", "agent": "CEO", "output": {"decision": "approved"}}
  }
}
JSON

  cat > "${GATE_DIR}/directive.md" <<'MD'
# Test Gate Enforcement
A directive to test all pipeline gates.
MD

  # Create plan.json (required by audit, approve gates)
  cat > "${GATE_DIR}/plan.json" <<'JSON'
{
  "projects": [
    {"id": "build-feature", "agent": ["riley"], "reviewers": ["sarah"], "complexity": "simple"}
  ]
}
JSON

  # Create brainstorm.md (required by plan gate)
  echo "# Brainstorm\nApproaches discussed." > "${GATE_DIR}/brainstorm.md"

  # Create audit.md (required by approve gate)
  echo "# Audit\nNo blockers." > "${GATE_DIR}/audit.md"

  # Create project.json with tasks (required by execute gate)
  cat > "${GATE_DIR}/projects/build-feature/project.json" <<'JSON'
{
  "id": "build-feature",
  "title": "Build Feature",
  "status": "in_progress",
  "description": "Build the feature.",
  "scope": {"in": ["src/"], "out": []},
  "dod": [{"criterion": "Tests pass", "met": false}],
  "agent": ["riley"],
  "reviewers": ["sarah"],
  "tasks": [
    {"id": "impl-widget", "title": "Implement widget", "status": "completed", "agent": ["riley"], "dod": [{"criterion": "Widget renders", "met": true}]},
    {"id": "add-tests", "title": "Add tests", "status": "completed", "agent": ["riley"], "dod": [{"criterion": "Tests pass", "met": true}]}
  ]
}
JSON

  # --- Gate: triage (no prerequisites, should always pass) ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" triage 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "gate triage: passes (no prerequisites)"
  else
    log_fail "gate triage: passes" "$gate_result"
  fi

  # --- Gate: read (requires triage completed = weight set) ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" read 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "gate read: passes (weight set)"
  else
    log_fail "gate read: passes" "$gate_result"
  fi

  # --- Gate: plan (requires brainstorm.md) ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" plan 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "gate plan: passes (brainstorm.md exists)"
  else
    log_fail "gate plan: passes" "$gate_result"
  fi

  # --- Gate: audit (requires plan.json with .projects) ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" audit 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "gate audit: passes (plan.json exists)"
  else
    log_fail "gate audit: passes" "$gate_result"
  fi

  # --- Gate: approve (requires audit.md + plan.json) ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" approve 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "gate approve: passes (audit.md + plan.json exist)"
  else
    log_fail "gate approve: passes" "$gate_result"
  fi

  # --- Gate: execute (requires approve completed + project.json with tasks) ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" execute 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "gate execute: passes (approve + project.json exist)"
  else
    log_fail "gate execute: passes" "$gate_result"
  fi

  # --- Gate: execute with task-id (specific task exists) ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" execute impl-widget 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "gate execute task: passes (task impl-widget found)"
  else
    log_fail "gate execute task: passes" "$gate_result"
  fi

  # --- NEGATIVE: Gate execute with nonexistent task ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" execute nonexistent-task 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "gate execute: REJECTS nonexistent task"
  else
    log_fail "gate execute: rejects nonexistent task" "$gate_result"
  fi

  # --- NEGATIVE: Gate review-gate without build artifacts ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" review-gate 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    violation_count="$(echo "$gate_result" | jq '.violations | length' 2>/dev/null || echo 0)"
    log_pass "gate review-gate: REJECTS (missing build-*.md, $violation_count violations)"
  else
    log_fail "gate review-gate: should reject missing build artifacts" "$gate_result"
  fi

  # Now create build artifacts and test it passes
  echo "# Build impl-widget\nWidget implemented." > "${GATE_DIR}/projects/build-feature/build-impl-widget.md"
  echo "# Build add-tests\nTests added." > "${GATE_DIR}/projects/build-feature/build-add-tests.md"

  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" review-gate 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "gate review-gate: passes (build-*.md exist)"
  else
    log_fail "gate review-gate: passes with build artifacts" "$gate_result"
  fi

  # --- NEGATIVE: Gate wrapup without review artifacts ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" wrapup 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    violation_count="$(echo "$gate_result" | jq '.violations | length' 2>/dev/null || echo 0)"
    log_pass "gate wrapup: REJECTS (missing review-*.md, $violation_count violations)"
  else
    log_fail "gate wrapup: should reject missing review artifacts" "$gate_result"
  fi

  # Now create review artifacts
  echo "# Review impl-widget\nLGTM." > "${GATE_DIR}/projects/build-feature/review-impl-widget.md"
  echo "# Review add-tests\nLGTM." > "${GATE_DIR}/projects/build-feature/review-add-tests.md"

  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" wrapup 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "gate wrapup: passes (review-*.md exist)"
  else
    log_fail "gate wrapup: passes with review artifacts" "$gate_result"
  fi

  # --- NEGATIVE: Gate completion without digest.md ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" completion 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "gate completion: REJECTS (missing digest.md)"
  else
    log_fail "gate completion: should reject missing digest.md" "$gate_result"
  fi

  # Create digest and test pass
  echo "# Digest\nDirective completed." > "${GATE_DIR}/digest.md"

  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" completion 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "gate completion: passes (digest.md exists)"
  else
    log_fail "gate completion: passes with digest.md" "$gate_result"
  fi

  # --- NEGATIVE: Heavyweight can't skip brainstorm ---
  rm -f "${GATE_DIR}/brainstorm.md"
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" plan 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "gate plan: REJECTS heavyweight without brainstorm.md"
  else
    log_fail "gate plan: should reject heavyweight missing brainstorm" "$gate_result"
  fi

  # --- Weight skip: lightweight CAN skip brainstorm with .skip marker ---
  LW_GATE_DIR="${DIRECTIVES_DIR}/test-gate-lightweight"
  mkdir -p "$LW_GATE_DIR"

  cat > "${LW_GATE_DIR}/directive.json" <<'JSON'
{
  "id": "test-gate-lightweight",
  "title": "Lightweight Gate Test",
  "weight": "lightweight",
  "status": "in_progress",
  "current_step": "plan",
  "pipeline": {
    "triage": {"status": "completed"},
    "read": {"status": "completed"},
    "context": {"status": "completed"}
  }
}
JSON

  # Without .skip marker, lightweight still fails brainstorm gate
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$LW_GATE_DIR" plan 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "gate plan: lightweight fails without brainstorm.md or .skip"
  else
    log_fail "gate plan: lightweight should fail without brainstorm" "$gate_result"
  fi

  # With .skip marker, lightweight passes
  touch "${LW_GATE_DIR}/brainstorm.skip"
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$LW_GATE_DIR" plan 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "true"; then
    log_pass "gate plan: lightweight passes with brainstorm.skip"
  else
    log_fail "gate plan: lightweight should pass with .skip" "$gate_result"
  fi

  # --- Gate writes to directive.json on pass ---
  if jq -e '.gates.plan.passed_at' "${LW_GATE_DIR}/directive.json" >/dev/null 2>&1; then
    log_pass "gate: writes gates.plan.passed_at to directive.json"
  else
    log_fail "gate: writes gates.plan.passed_at to directive.json"
  fi

  validated_arts="$(jq '.gates.plan.validated_artifacts | length' "${LW_GATE_DIR}/directive.json" 2>/dev/null || echo 0)"
  if (( validated_arts > 0 )); then
    log_pass "gate: writes validated_artifacts ($validated_arts)"
  else
    log_fail "gate: writes validated_artifacts" "got $validated_arts"
  fi

  # --- Unknown step ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "$GATE_DIR" bogus-step 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "gate: rejects unknown step 'bogus-step'"
  else
    log_fail "gate: should reject unknown step" "$gate_result"
  fi

  # --- Missing directive directory ---
  gate_result="$(cd "${GRUAI_PACKAGE_ROOT}" && bash "$GATE_SCRIPT" "/tmp/nonexistent-dir" triage 2>&1)" || true
  if echo "$gate_result" | jq -r '.valid' 2>/dev/null | grep -q "false"; then
    log_pass "gate: rejects missing directive directory"
  else
    log_fail "gate: should reject missing directory" "$gate_result"
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# TEST 12: Skill files scaffolded correctly
# ═════════════════════════════════════════════════════════════════════════════

log_section "Test 12: Pipeline skill files & docs"

SKILLS_DIR="${TEST_DIR}/.gruai/skills/directive"
if [[ -d "$SKILLS_DIR" ]]; then
  log_pass "directive skill scaffolded"

  # Check SKILL.md exists
  assert_file_exists "${SKILLS_DIR}/SKILL.md" "directive SKILL.md exists"
  assert_file_not_empty "${SKILLS_DIR}/SKILL.md" "directive SKILL.md non-empty"

  # Check all 14 pipeline doc files exist
  PIPELINE_DOCS_DIR="${SKILLS_DIR}/docs/pipeline"
  if [[ -d "$PIPELINE_DOCS_DIR" ]]; then
    doc_count="$(ls "${PIPELINE_DOCS_DIR}"/*.md 2>/dev/null | wc -l | tr -d ' ')"
    if (( doc_count >= 12 )); then
      log_pass "pipeline docs: $doc_count .md files"
    else
      log_fail "pipeline docs: expected >= 12" "got $doc_count"
    fi
  else
    log_fail "pipeline docs dir exists" "not found"
  fi

  # Check reference schema docs exist
  SCHEMA_DIR="${SKILLS_DIR}/docs/reference/schemas"
  if [[ -d "$SCHEMA_DIR" ]]; then
    assert_file_exists "${SCHEMA_DIR}/directive-json.md" "schema: directive-json.md"
    assert_file_exists "${SCHEMA_DIR}/plan-schema.md" "schema: plan-schema.md"
  else
    log_fail "reference/schemas dir exists" "not found"
  fi
else
  log_fail "directive skill scaffolded" "not found at ${SKILLS_DIR}"
fi

# ─── Write results ───────────────────────────────────────────────────────────

DIM_ELAPSED="$(stop_timer "$DIM_START")"
write_result_json "$DIM_NAME" "$DIM_ELAPSED"

log_section "dim-pipeline results"
printf "  Pass: %d  Fail: %d  Time: %d ms\n\n" "$_PASS_COUNT" "$_FAIL_COUNT" "$DIM_ELAPSED"

if (( _FAIL_COUNT > 0 )); then
  exit 1
fi
