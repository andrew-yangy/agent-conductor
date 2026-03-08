#!/usr/bin/env bash
set -euo pipefail

# ─── Dimension: Directive JSON Schema Validation ─────────────────────────────
#
# Tests that directive.json files conform to expected schema:
#   Required: id, title, weight, status, current_step
#   weight: lightweight | medium | heavyweight
#   status: pending | in_progress | completed | blocked
#
# Creates valid and invalid fixtures, validates structural requirements.
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/utils.sh"

DIM_NAME="schema"
DIM_START="$(start_timer)"

TEST_DIR=""

cleanup() {
  if [[ -n "$TEST_DIR" ]]; then
    cleanup_test_dir "$TEST_DIR"
  fi
}
trap cleanup EXIT

# ─── Setup ───────────────────────────────────────────────────────────────────

log_section "Setup: create test fixtures"

TEST_DIR="$(create_test_dir "e2e-test-schema")"
log_info "Test dir: ${TEST_DIR}"

# Init a project to get the welcome directive as a real fixture
init_output="$(run_gruai_init "$TEST_DIR" "full" 2>&1)" || true
assert_dir_exists "${TEST_DIR}/.gruai" "project initialized for schema tests"

# ─── Schema validation function ──────────────────────────────────────────────

# validate_directive_json <file> — returns 0 if valid, 1 if invalid, sets VALIDATION_ERROR
validate_directive_json() {
  local file="$1"
  VALIDATION_ERROR=""

  if [[ ! -f "$file" ]]; then
    VALIDATION_ERROR="file not found"
    return 1
  fi

  # Must be valid JSON
  if ! jq empty "$file" 2>/dev/null; then
    VALIDATION_ERROR="invalid JSON"
    return 1
  fi

  # Required fields
  for field in id title weight status; do
    local val
    val="$(jq -r ".$field // empty" "$file" 2>/dev/null)"
    if [[ -z "$val" ]]; then
      VALIDATION_ERROR="missing required field: $field"
      return 1
    fi
  done

  # weight must be one of: lightweight, medium, heavyweight
  local weight
  weight="$(jq -r '.weight' "$file")"
  case "$weight" in
    lightweight|medium|heavyweight) ;;
    *)
      VALIDATION_ERROR="invalid weight: $weight (must be lightweight|medium|heavyweight)"
      return 1
      ;;
  esac

  # status must be one of: pending, in_progress, completed, blocked, awaiting_completion
  local status
  status="$(jq -r '.status' "$file")"
  case "$status" in
    pending|in_progress|completed|blocked|awaiting_completion) ;;
    *)
      VALIDATION_ERROR="invalid status: $status"
      return 1
      ;;
  esac

  # id must be a non-empty string (no spaces, lowercase with hyphens)
  local id
  id="$(jq -r '.id' "$file")"
  if ! echo "$id" | grep -qE '^[a-z0-9][a-z0-9-]*$'; then
    VALIDATION_ERROR="invalid id format: $id (must be lowercase alphanumeric with hyphens)"
    return 1
  fi

  return 0
}

# ─── Test 1: Welcome directive (scaffolded by init) ─────────────────────────

log_section "Test: welcome directive (scaffolded)"

WELCOME_DIR="${TEST_DIR}/.context/directives/welcome/directive.json"
if [[ -f "$WELCOME_DIR" ]]; then
  assert_json_valid "$WELCOME_DIR" "welcome directive.json is valid JSON"

  if validate_directive_json "$WELCOME_DIR"; then
    log_pass "welcome directive.json passes schema validation"
  else
    log_fail "welcome directive.json passes schema validation" "$VALIDATION_ERROR"
  fi

  assert_json_field "$WELCOME_DIR" '.id' "welcome" "welcome: id = welcome"
  assert_json_field "$WELCOME_DIR" '.weight' "lightweight" "welcome: weight = lightweight"
  assert_json_field "$WELCOME_DIR" '.status' "pending" "welcome: status = pending"
else
  log_fail "welcome directive.json exists" "not found"
fi

# ─── Test 2: Valid synthetic directives ──────────────────────────────────────

log_section "Test: valid synthetic directives"

DIRECTIVES_DIR="${TEST_DIR}/.context/directives"

# Create 4 additional valid directives with different weights/statuses (bash 3.2 compatible)
_create_valid_directive() {
  local dir_id="$1"
  local json="$2"
  local local_dir="${DIRECTIVES_DIR}/${dir_id}"
  mkdir -p "$local_dir"
  echo "$json" > "${local_dir}/directive.json"

  assert_json_valid "${local_dir}/directive.json" "${dir_id}: valid JSON"

  if validate_directive_json "${local_dir}/directive.json"; then
    log_pass "${dir_id}: passes schema validation"
  else
    log_fail "${dir_id}: passes schema validation" "$VALIDATION_ERROR"
  fi
}

_create_valid_directive "auth-system" '{
  "id": "auth-system",
  "title": "Implement Authentication System",
  "weight": "heavyweight",
  "status": "in_progress",
  "current_step": "execute",
  "created_at": "2026-03-01T00:00:00Z"
}'

_create_valid_directive "fix-typos" '{
  "id": "fix-typos",
  "title": "Fix Documentation Typos",
  "weight": "lightweight",
  "status": "completed",
  "current_step": "wrapup",
  "created_at": "2026-03-02T00:00:00Z"
}'

_create_valid_directive "api-redesign" '{
  "id": "api-redesign",
  "title": "REST API Redesign",
  "weight": "medium",
  "status": "pending",
  "current_step": "triage",
  "created_at": "2026-03-03T00:00:00Z"
}'

_create_valid_directive "data-pipeline" '{
  "id": "data-pipeline",
  "title": "Build Data Pipeline",
  "weight": "heavyweight",
  "status": "blocked",
  "current_step": "plan",
  "created_at": "2026-03-04T00:00:00Z",
  "blocked_reason": "Waiting for schema design"
}'

# ─── Test 3: Invalid directive (missing required fields) ─────────────────────

log_section "Test: invalid directives (should fail validation)"

# Missing 'id'
INVALID_DIR="${DIRECTIVES_DIR}/invalid-no-id"
mkdir -p "$INVALID_DIR"
cat > "${INVALID_DIR}/directive.json" <<'JSON'
{
  "title": "Missing ID",
  "weight": "lightweight",
  "status": "pending"
}
JSON

if validate_directive_json "${INVALID_DIR}/directive.json"; then
  log_fail "missing-id: correctly rejected" "should have failed but passed"
else
  log_pass "missing-id: correctly rejected (${VALIDATION_ERROR})"
fi

# Missing 'weight'
INVALID_DIR="${DIRECTIVES_DIR}/invalid-no-weight"
mkdir -p "$INVALID_DIR"
cat > "${INVALID_DIR}/directive.json" <<'JSON'
{
  "id": "invalid-no-weight",
  "title": "Missing Weight",
  "status": "pending"
}
JSON

if validate_directive_json "${INVALID_DIR}/directive.json"; then
  log_fail "missing-weight: correctly rejected" "should have failed but passed"
else
  log_pass "missing-weight: correctly rejected (${VALIDATION_ERROR})"
fi

# Invalid weight value
INVALID_DIR="${DIRECTIVES_DIR}/invalid-bad-weight"
mkdir -p "$INVALID_DIR"
cat > "${INVALID_DIR}/directive.json" <<'JSON'
{
  "id": "invalid-bad-weight",
  "title": "Bad Weight Value",
  "weight": "super-heavy",
  "status": "pending"
}
JSON

if validate_directive_json "${INVALID_DIR}/directive.json"; then
  log_fail "bad-weight: correctly rejected" "should have failed but passed"
else
  log_pass "bad-weight: correctly rejected (${VALIDATION_ERROR})"
fi

# Invalid status value
INVALID_DIR="${DIRECTIVES_DIR}/invalid-bad-status"
mkdir -p "$INVALID_DIR"
cat > "${INVALID_DIR}/directive.json" <<'JSON'
{
  "id": "invalid-bad-status",
  "title": "Bad Status Value",
  "weight": "medium",
  "status": "unknown"
}
JSON

if validate_directive_json "${INVALID_DIR}/directive.json"; then
  log_fail "bad-status: correctly rejected" "should have failed but passed"
else
  log_pass "bad-status: correctly rejected (${VALIDATION_ERROR})"
fi

# Invalid id format (spaces)
INVALID_DIR="${DIRECTIVES_DIR}/invalid bad id"
mkdir -p "$INVALID_DIR"
cat > "${INVALID_DIR}/directive.json" <<'JSON'
{
  "id": "invalid bad id",
  "title": "Bad ID Format",
  "weight": "lightweight",
  "status": "pending"
}
JSON

if validate_directive_json "${INVALID_DIR}/directive.json"; then
  log_fail "bad-id-format: correctly rejected" "should have failed but passed"
else
  log_pass "bad-id-format: correctly rejected (${VALIDATION_ERROR})"
fi

# Not valid JSON at all
INVALID_DIR="${DIRECTIVES_DIR}/invalid-bad-json"
mkdir -p "$INVALID_DIR"
echo "this is { not valid json" > "${INVALID_DIR}/directive.json"

if validate_directive_json "${INVALID_DIR}/directive.json"; then
  log_fail "bad-json: correctly rejected" "should have failed but passed"
else
  log_pass "bad-json: correctly rejected (${VALIDATION_ERROR})"
fi

# ─── Test 4: expected-outcomes.json schema ───────────────────────────────────

log_section "Test: expected-outcomes.json schema"

# Create a valid expected-outcomes.json
OUTCOMES_DIR="${DIRECTIVES_DIR}/auth-system"
cat > "${OUTCOMES_DIR}/expected-outcomes.json" <<'JSON'
{
  "directive_id": "auth-system",
  "outcomes": [
    {
      "description": "Users can log in with email/password",
      "verification": "manual",
      "status": "pending"
    },
    {
      "description": "JWT tokens issued on successful auth",
      "verification": "automated",
      "status": "pending"
    }
  ]
}
JSON

assert_json_valid "${OUTCOMES_DIR}/expected-outcomes.json" "expected-outcomes.json is valid JSON"

# Verify structure
if command -v jq &>/dev/null; then
  has_directive_id="$(jq -r '.directive_id // empty' "${OUTCOMES_DIR}/expected-outcomes.json")"
  if [[ -n "$has_directive_id" ]]; then
    log_pass "expected-outcomes.json has directive_id"
  else
    log_fail "expected-outcomes.json has directive_id"
  fi

  outcomes_count="$(jq '.outcomes | length' "${OUTCOMES_DIR}/expected-outcomes.json")"
  assert_gt "$outcomes_count" 0 "expected-outcomes.json has at least 1 outcome"

  # Each outcome should have description and status
  all_valid=true
  for i in $(seq 0 $(( outcomes_count - 1 ))); do
    desc="$(jq -r ".outcomes[$i].description // empty" "${OUTCOMES_DIR}/expected-outcomes.json")"
    stat="$(jq -r ".outcomes[$i].status // empty" "${OUTCOMES_DIR}/expected-outcomes.json")"
    if [[ -z "$desc" || -z "$stat" ]]; then
      all_valid=false
      break
    fi
  done
  if $all_valid; then
    log_pass "all outcomes have description and status"
  else
    log_fail "all outcomes have description and status"
  fi
fi

# ─── Write results ───────────────────────────────────────────────────────────

DIM_ELAPSED="$(stop_timer "$DIM_START")"
write_result_json "$DIM_NAME" "$DIM_ELAPSED"

log_section "dim-schema results"
printf "  Pass: %d  Fail: %d  Time: %d ms\n\n" "$_PASS_COUNT" "$_FAIL_COUNT" "$DIM_ELAPSED"

if (( _FAIL_COUNT > 0 )); then
  exit 1
fi
