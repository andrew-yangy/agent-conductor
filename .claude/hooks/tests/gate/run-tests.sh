#!/usr/bin/env bash
# run-tests.sh — Test runner for validate-gate.sh
#
# Exercises all fixture directories and reports pass/fail.
# Exit 0 when all tests pass, exit 1 with details on failure.
#
# Usage: ./run-tests.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GATE_SCRIPT="$(cd "$SCRIPT_DIR/../.." && pwd)/validate-gate.sh"
PASS_COUNT=0
FAIL_COUNT=0
FAILURES=()

# Colors (if terminal supports them)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

run_test() {
  local name="$1"
  local fixture_dir="$2"
  local target_step="$3"
  local expect_valid="$4"  # "true" or "false"
  local extra_args="${5:-}"
  local expect_violation_substr="${6:-}"

  # Make a working copy so directive.json writes don't pollute fixtures
  local tmpdir
  tmpdir=$(mktemp -d)
  cp -R "$fixture_dir/" "$tmpdir/"

  local output
  if [[ -n "$extra_args" ]]; then
    output=$("$GATE_SCRIPT" "$tmpdir" "$target_step" "$extra_args" 2>&1) || true
  else
    output=$("$GATE_SCRIPT" "$tmpdir" "$target_step" 2>&1) || true
  fi

  local actual_valid
  actual_valid=$(echo "$output" | jq -r '.valid' 2>/dev/null || echo "parse_error")

  local test_passed=true

  if [[ "$actual_valid" != "$expect_valid" ]]; then
    test_passed=false
  fi

  # If we expect a specific violation substring, check for it
  if [[ -n "$expect_violation_substr" && "$expect_valid" == "false" ]]; then
    if ! echo "$output" | jq -r '.violations[].message' 2>/dev/null | grep -q "$expect_violation_substr"; then
      test_passed=false
    fi
  fi

  # If gate passed (valid=true), verify it wrote to directive.json
  if [[ "$expect_valid" == "true" && "$actual_valid" == "true" ]]; then
    local gates_entry
    gates_entry=$(jq -r ".gates.\"$target_step\".passed_at // empty" "$tmpdir/directive.json" 2>/dev/null)
    if [[ -z "$gates_entry" ]]; then
      test_passed=false
      echo -e "  ${RED}FAIL${NC} $name — gate passed but did not write gates.$target_step to directive.json"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      FAILURES+=("$name (gates write missing)")
      rm -rf "$tmpdir"
      return
    fi
  fi

  if [[ "$test_passed" == "true" ]]; then
    echo -e "  ${GREEN}PASS${NC} $name"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}FAIL${NC} $name"
    echo "    Expected valid=$expect_valid, got valid=$actual_valid"
    echo "    Output: $(echo "$output" | head -5)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILURES+=("$name")
  fi

  rm -rf "$tmpdir"
}

echo ""
echo "validate-gate.sh Test Suite"
echo "==========================="
echo ""

# ---------------------------------------------------------------------------
# Test 01: Valid lightweight with .skip markers
# ---------------------------------------------------------------------------
echo "01: Lightweight directive with .skip markers"

run_test \
  "plan gate passes with brainstorm.skip (lightweight)" \
  "$SCRIPT_DIR/01-valid-lightweight-skip" \
  "plan" \
  "true"

run_test \
  "execute gate passes with approve.skip (lightweight)" \
  "$SCRIPT_DIR/01-valid-lightweight-skip" \
  "execute" \
  "true"

# ---------------------------------------------------------------------------
# Test 02: Valid heavyweight — full artifact chain
# ---------------------------------------------------------------------------
echo ""
echo "02: Heavyweight directive with all artifacts"

run_test \
  "plan gate passes (brainstorm.md exists)" \
  "$SCRIPT_DIR/02-valid-heavyweight" \
  "plan" \
  "true"

run_test \
  "audit gate passes (plan.json exists with .projects)" \
  "$SCRIPT_DIR/02-valid-heavyweight" \
  "audit" \
  "true"

run_test \
  "execute gate passes (approval in directive.json)" \
  "$SCRIPT_DIR/02-valid-heavyweight" \
  "execute" \
  "true"

run_test \
  "review-gate passes for task-1 (build-task-1.md exists)" \
  "$SCRIPT_DIR/02-valid-heavyweight" \
  "review-gate" \
  "true" \
  "task-1"

run_test \
  "wrapup gate passes (all reviews exist)" \
  "$SCRIPT_DIR/02-valid-heavyweight" \
  "wrapup" \
  "true"

run_test \
  "completion gate passes (digest.md exists)" \
  "$SCRIPT_DIR/02-valid-heavyweight" \
  "completion" \
  "true"

# ---------------------------------------------------------------------------
# Test 03: Fail — missing brainstorm for heavyweight
# ---------------------------------------------------------------------------
echo ""
echo "03: Missing brainstorm for heavyweight"

run_test \
  "plan gate fails (no brainstorm.md, heavyweight)" \
  "$SCRIPT_DIR/03-fail-missing-brainstorm" \
  "plan" \
  "false" \
  "" \
  "Missing brainstorm artifact"

# ---------------------------------------------------------------------------
# Test 04: Fail — missing review artifact
# ---------------------------------------------------------------------------
echo ""
echo "04: Missing review artifact blocks wrapup"

run_test \
  "wrapup gate fails (review-task-b.md missing)" \
  "$SCRIPT_DIR/04-fail-missing-review" \
  "wrapup" \
  "false" \
  "" \
  "Missing review artifact"

# ---------------------------------------------------------------------------
# Test 05: Valid completion gate
# ---------------------------------------------------------------------------
echo ""
echo "05: Valid completion gate"

run_test \
  "completion gate passes (digest.md exists, strategic)" \
  "$SCRIPT_DIR/05-valid-completion" \
  "completion" \
  "true"

# ---------------------------------------------------------------------------
# Test 06: Fail — missing build artifact blocks review
# ---------------------------------------------------------------------------
echo ""
echo "06: Missing build artifact blocks review"

run_test \
  "review-gate fails for task 'widget' (no build-widget.md)" \
  "$SCRIPT_DIR/06-fail-missing-build" \
  "review-gate" \
  "false" \
  "widget" \
  "Missing build artifact"

# ---------------------------------------------------------------------------
# Test 07: Valid medium — full chain through execute
# ---------------------------------------------------------------------------
echo ""
echo "07: Medium directive with full chain"

run_test \
  "plan gate passes (brainstorm.md exists, medium)" \
  "$SCRIPT_DIR/07-valid-medium-full" \
  "plan" \
  "true"

run_test \
  "audit gate passes (plan.json valid)" \
  "$SCRIPT_DIR/07-valid-medium-full" \
  "audit" \
  "true"

run_test \
  "approve gate passes (project.json with tasks)" \
  "$SCRIPT_DIR/07-valid-medium-full" \
  "approve" \
  "true"

run_test \
  "execute gate passes (approval completed)" \
  "$SCRIPT_DIR/07-valid-medium-full" \
  "execute" \
  "true"

# ---------------------------------------------------------------------------
# Test 08: Fail — invalid JSON in plan.json
# ---------------------------------------------------------------------------
echo ""
echo "08: Invalid JSON in artifact"

run_test \
  "audit gate fails (plan.json is invalid JSON)" \
  "$SCRIPT_DIR/08-fail-invalid-json" \
  "audit" \
  "false" \
  "" \
  "not valid JSON"

# ---------------------------------------------------------------------------
# Test 09: Fail — malformed directive.json
# ---------------------------------------------------------------------------
echo ""
echo "09: Malformed directive.json"

run_test \
  "plan gate fails (directive.json is not valid JSON)" \
  "$SCRIPT_DIR/09-malformed-directive-json" \
  "plan" \
  "false" \
  "" \
  "not valid JSON"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "==========================="
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo -e "Results: ${GREEN}${PASS_COUNT}${NC} passed, ${RED}${FAIL_COUNT}${NC} failed, ${TOTAL} total"

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo ""
  echo "Failures:"
  for f in "${FAILURES[@]}"; do
    echo -e "  ${RED}-${NC} $f"
  done
  exit 1
fi

echo ""
echo -e "${GREEN}All tests passed.${NC}"
exit 0
