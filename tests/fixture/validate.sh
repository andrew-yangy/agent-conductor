#!/usr/bin/env bash
# validate.sh — Checks post-run file state against expected outcomes
# Usage: ./validate.sh <directive-id|all> [--dry-run]
# Dependencies: jq, grep (standard Unix tools)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE_DIR="$SCRIPT_DIR"
DIRECTIVES_DIR="$FIXTURE_DIR/.context/directives"

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' BOLD='' RESET=''
fi

DRY_RUN=false
DIRECTIVE_ID=""
TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0

usage() {
  echo "Usage: $0 <directive-id|all> [--dry-run]"
  echo ""
  echo "Arguments:"
  echo "  directive-id    ID of a specific directive to validate"
  echo "  all             Validate all directives with expected-outcomes.json"
  echo ""
  echo "Options:"
  echo "  --dry-run       Show what would be checked without running checks"
  echo "  --help          Show this help message"
  exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --help|-h) usage ;;
    *) DIRECTIVE_ID="$1"; shift ;;
  esac
done

if [ -z "$DIRECTIVE_ID" ]; then
  echo "Error: directive ID or 'all' is required"
  usage
fi

log_pass() {
  echo -e "  ${GREEN}PASS${RESET} $1"
  TOTAL_PASS=$((TOTAL_PASS + 1))
}

log_fail() {
  echo -e "  ${RED}FAIL${RESET} $1"
  if [ -n "${2:-}" ]; then
    echo -e "       Expected: $2"
    echo -e "       Actual:   ${3:-<none>}"
  fi
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
}

log_skip() {
  echo -e "  ${YELLOW}SKIP${RESET} $1"
  TOTAL_SKIP=$((TOTAL_SKIP + 1))
}

# Validate a single directive
validate_directive() {
  local dir_id="$1"
  local dir_path="$DIRECTIVES_DIR/$dir_id"
  local outcomes_file="$dir_path/expected-outcomes.json"

  echo -e "\n${BOLD}=== Directive: $dir_id ===${RESET}"

  # Check expected-outcomes.json exists
  if [ ! -f "$outcomes_file" ]; then
    log_fail "expected-outcomes.json not found at $outcomes_file"
    return
  fi

  if $DRY_RUN; then
    echo "  [dry-run] Would check expected-outcomes.json: $outcomes_file"

    local mod_count created_count deleted_count pattern_count unexpected_count
    mod_count=$(jq '.files_modified | length' "$outcomes_file")
    created_count=$(jq '.files_created | length' "$outcomes_file")
    deleted_count=$(jq '.files_deleted | length' "$outcomes_file")
    pattern_count=$(jq '.expected_patterns | length' "$outcomes_file")
    unexpected_count=$(jq '.unexpected_patterns // [] | length' "$outcomes_file")

    echo "  [dry-run] files_modified:     $mod_count files"
    echo "  [dry-run] files_created:       $created_count files"
    echo "  [dry-run] files_deleted:       $deleted_count files"
    echo "  [dry-run] expected_patterns:   $pattern_count patterns"
    echo "  [dry-run] unexpected_patterns: $unexpected_count patterns"
    return
  fi

  # --- Check files_modified ---
  local mod_count
  mod_count=$(jq '.files_modified | length' "$outcomes_file")
  if [ "$mod_count" -gt 0 ]; then
    echo "  --- files_modified ($mod_count) ---"
    for i in $(seq 0 $((mod_count - 1))); do
      local file
      file=$(jq -r ".files_modified[$i]" "$outcomes_file")
      local full_path="$FIXTURE_DIR/$file"
      if [ -f "$full_path" ]; then
        # For files_modified, we check if the file has been changed from its original.
        # On unmodified fixture, these should exist (they do) but expected_patterns
        # will determine if the fix was applied. Just verify file exists.
        log_pass "file exists: $file"
      else
        log_fail "file missing: $file" "file should exist" "not found"
      fi
    done
  fi

  # --- Check files_created ---
  local created_count
  created_count=$(jq '.files_created | length' "$outcomes_file")
  if [ "$created_count" -gt 0 ]; then
    echo "  --- files_created ($created_count) ---"
    for i in $(seq 0 $((created_count - 1))); do
      local file
      file=$(jq -r ".files_created[$i]" "$outcomes_file")
      local full_path="$FIXTURE_DIR/$file"
      if [ -f "$full_path" ]; then
        log_pass "file created: $file"
      else
        log_fail "file not created: $file" "file should exist after fix" "not found"
      fi
    done
  fi

  # --- Check files_deleted ---
  local deleted_count
  deleted_count=$(jq '.files_deleted | length' "$outcomes_file")
  if [ "$deleted_count" -gt 0 ]; then
    echo "  --- files_deleted ($deleted_count) ---"
    for i in $(seq 0 $((deleted_count - 1))); do
      local file
      file=$(jq -r ".files_deleted[$i]" "$outcomes_file")
      local full_path="$FIXTURE_DIR/$file"
      if [ ! -f "$full_path" ]; then
        log_pass "file deleted: $file"
      else
        log_fail "file still exists: $file" "file should be deleted after fix" "still present"
      fi
    done
  fi

  # --- Check expected_patterns ---
  local pattern_count
  pattern_count=$(jq '.expected_patterns | length' "$outcomes_file")
  if [ "$pattern_count" -gt 0 ]; then
    echo "  --- expected_patterns ($pattern_count) ---"
    for i in $(seq 0 $((pattern_count - 1))); do
      local file pattern desc
      file=$(jq -r ".expected_patterns[$i].file" "$outcomes_file")
      pattern=$(jq -r ".expected_patterns[$i].pattern" "$outcomes_file")
      desc=$(jq -r ".expected_patterns[$i].description" "$outcomes_file")
      local full_path="$FIXTURE_DIR/$file"

      if [ ! -f "$full_path" ]; then
        log_fail "pattern check — file missing: $file" "pattern: $pattern" "file not found"
        continue
      fi

      if grep -qE "$pattern" "$full_path" 2>/dev/null; then
        log_pass "pattern found in $file: $desc"
      else
        log_fail "pattern NOT found in $file: $desc" "pattern: $pattern" "no match in file"
      fi
    done
  fi

  # --- Check unexpected_patterns (should NOT be present after fix) ---
  local unexpected_count
  unexpected_count=$(jq '.unexpected_patterns // [] | length' "$outcomes_file")
  if [ "$unexpected_count" -gt 0 ]; then
    echo "  --- unexpected_patterns ($unexpected_count) ---"
    for i in $(seq 0 $((unexpected_count - 1))); do
      local file pattern desc
      file=$(jq -r ".unexpected_patterns[$i].file" "$outcomes_file")
      pattern=$(jq -r ".unexpected_patterns[$i].pattern" "$outcomes_file")
      desc=$(jq -r ".unexpected_patterns[$i].description" "$outcomes_file")
      local full_path="$FIXTURE_DIR/$file"

      if [ ! -f "$full_path" ]; then
        log_pass "unexpected pattern check — file removed: $file"
        continue
      fi

      if grep -qE "$pattern" "$full_path" 2>/dev/null; then
        log_fail "unexpected pattern STILL present in $file: $desc" "pattern should be removed: $pattern" "still matches"
      else
        log_pass "unexpected pattern absent from $file: $desc"
      fi
    done
  fi
}

# Main
if [ "$DIRECTIVE_ID" = "all" ]; then
  # Find all directives with expected-outcomes.json
  found=false
  for outcomes in "$DIRECTIVES_DIR"/*/expected-outcomes.json; do
    if [ -f "$outcomes" ]; then
      found=true
      dir_id=$(basename "$(dirname "$outcomes")")
      validate_directive "$dir_id"
    fi
  done
  if ! $found; then
    echo "No directives with expected-outcomes.json found in $DIRECTIVES_DIR"
    exit 1
  fi
else
  if [ ! -d "$DIRECTIVES_DIR/$DIRECTIVE_ID" ]; then
    echo "Error: directive '$DIRECTIVE_ID' not found at $DIRECTIVES_DIR/$DIRECTIVE_ID"
    exit 1
  fi
  validate_directive "$DIRECTIVE_ID"
fi

# Summary
echo -e "\n${BOLD}=== Summary ===${RESET}"
echo -e "  ${GREEN}PASS${RESET}: $TOTAL_PASS"
echo -e "  ${RED}FAIL${RESET}: $TOTAL_FAIL"
echo -e "  ${YELLOW}SKIP${RESET}: $TOTAL_SKIP"

if [ "$TOTAL_FAIL" -gt 0 ]; then
  echo -e "\n${RED}Result: FAILED${RESET} ($TOTAL_FAIL checks failed)"
  exit 1
else
  echo -e "\n${GREEN}Result: PASSED${RESET} (all checks passed)"
  exit 0
fi
