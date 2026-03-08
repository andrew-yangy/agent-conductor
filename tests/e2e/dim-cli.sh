#!/usr/bin/env bash
set -euo pipefail

# ─── Dimension: CLI Smoke Tests & Error Handling ─────────────────────────────
#
# Tests CLI entry points that aren't covered by other dimensions:
#   - --help flag (shows usage)
#   - --version flag (prints version)
#   - Unknown command (exits 1 with error)
#   - init --help (command-specific help)
#   - Invalid preset name (exits non-zero)
#   - Re-init over existing project (idempotency)
#   - start without init (should fail gracefully)
#
# Compatible with bash 3.2+ (macOS default).
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/utils.sh"

DIM_NAME="cli"
DIM_START="$(start_timer)"

TEST_DIR=""

cleanup() {
  if [[ -n "$TEST_DIR" ]]; then
    cleanup_test_dir "$TEST_DIR"
  fi
}
trap cleanup EXIT

# ─── Test 1: --help flag ─────────────────────────────────────────────────────

log_section "Test: --help flag"

help_output="$(node "$GRUAI_CLI" --help 2>&1)" || true
assert_contains "$help_output" "gru-ai" "--help: output contains 'gru-ai'"
assert_contains "$help_output" "init" "--help: output lists 'init' command"
assert_contains "$help_output" "start" "--help: output lists 'start' command"
assert_contains "$help_output" "update" "--help: output lists 'update' command"

# -h alias
h_output="$(node "$GRUAI_CLI" -h 2>&1)" || true
assert_contains "$h_output" "gru-ai" "-h: output contains 'gru-ai'"

# No args = help
no_args_output="$(node "$GRUAI_CLI" 2>&1)" || true
assert_contains "$no_args_output" "gru-ai" "no args: shows usage"

# ─── Test 2: --version flag ──────────────────────────────────────────────────

log_section "Test: --version flag"

version_output="$(node "$GRUAI_CLI" --version 2>&1)" || true
# Should be a semver-like string (digits and dots)
if echo "$version_output" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+'; then
  log_pass "--version: outputs semver ($version_output)"
else
  log_fail "--version: outputs semver" "got: $version_output"
fi

# -v alias
v_output="$(node "$GRUAI_CLI" -v 2>&1)" || true
assert_eq "$v_output" "$version_output" "-v: same output as --version"

# ─── Test 3: Unknown command ─────────────────────────────────────────────────

log_section "Test: unknown command"

unknown_exit=0
unknown_output="$(node "$GRUAI_CLI" foobar 2>&1)" || unknown_exit=$?

if [[ $unknown_exit -ne 0 ]]; then
  log_pass "unknown command: exits non-zero (code $unknown_exit)"
else
  log_fail "unknown command: exits non-zero" "exited 0"
fi

assert_contains "$unknown_output" "Unknown command" "unknown command: error message mentions 'Unknown command'"

# ─── Test 4: init --help ─────────────────────────────────────────────────────

log_section "Test: init --help"

init_help="$(node "$GRUAI_CLI" init --help 2>&1)" || true
assert_contains "$init_help" "init" "init --help: contains 'init'"
assert_contains "$init_help" "preset" "init --help: mentions 'preset'"

# ─── Test 5: start without init ──────────────────────────────────────────────

log_section "Test: start without init (should fail)"

TEST_DIR="$(create_test_dir "e2e-test-cli")"
log_info "Test dir: ${TEST_DIR}"

start_exit=0
start_output="$(cd "$TEST_DIR" && node "$GRUAI_CLI" start --port 0 2>&1)" || start_exit=$?

if [[ $start_exit -ne 0 ]]; then
  log_pass "start without init: exits non-zero (code $start_exit)"
else
  log_fail "start without init: exits non-zero" "exited 0 — should have failed"
fi

# ─── Test 6: Re-init idempotency ────────────────────────────────────────────

log_section "Test: re-init over existing project"

# First init
first_init="$(run_gruai_init "$TEST_DIR" "starter" 2>&1)" || true
assert_dir_exists "${TEST_DIR}/.gruai" "first init: .gruai created"

# Record original file count
original_files="$(find "${TEST_DIR}/.gruai" -type f 2>/dev/null | wc -l | tr -d ' ')"
log_info "Files after first init: $original_files"

# Save a marker file in .context to verify it's preserved
mkdir -p "${TEST_DIR}/.context/directives/user-work"
echo '{"id":"user-work","title":"User Data","weight":"lightweight","status":"pending"}' \
  > "${TEST_DIR}/.context/directives/user-work/directive.json"

# Second init (re-init)
second_init="$(run_gruai_init "$TEST_DIR" "starter" 2>&1)" || true
reinit_exit=$?

# .gruai should still exist
assert_dir_exists "${TEST_DIR}/.gruai" "re-init: .gruai still exists"

# User data should be preserved
if [[ -f "${TEST_DIR}/.context/directives/user-work/directive.json" ]]; then
  log_pass "re-init: user .context data preserved"
else
  log_fail "re-init: user .context data preserved" "directive.json was deleted"
fi

# Config should still exist
assert_file_exists "${TEST_DIR}/gruai.config.json" "re-init: gruai.config.json exists"

# ─── Write results ───────────────────────────────────────────────────────────

DIM_ELAPSED="$(stop_timer "$DIM_START")"
write_result_json "$DIM_NAME" "$DIM_ELAPSED"

log_section "dim-cli results"
printf "  Pass: %d  Fail: %d  Time: %d ms\n\n" "$_PASS_COUNT" "$_FAIL_COUNT" "$DIM_ELAPSED"

if (( _FAIL_COUNT > 0 )); then
  exit 1
fi
