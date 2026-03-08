#!/usr/bin/env bash
set -euo pipefail

# ─── Dimension: Server Startup & Dashboard ───────────────────────────────────
#
# Tests that gru-ai start launches the server, serves health/state/dashboard.
#
# 1. Init a project (starter preset for speed)
# 2. Start server on a free port
# 3. Verify /api/health, /api/state, dashboard HTML
# 4. Clean up
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/utils.sh"

DIM_NAME="server"
DIM_START="$(start_timer)"

SERVER_PID=""
TEST_DIR=""

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

log_section "Setup: init project"

TEST_DIR="$(create_test_dir "e2e-test-server")"
log_info "Test dir: ${TEST_DIR}"

# Init with starter preset (fastest)
init_output="$(run_gruai_init "$TEST_DIR" "starter" 2>&1)" || true
assert_dir_exists "${TEST_DIR}/.gruai" "project initialized"

# ─── Start server ────────────────────────────────────────────────────────────

log_section "Server startup"

PORT="$(find_free_port)"
log_info "Using port: ${PORT}"

# Start server in background using local CLI
run_gruai_start "$TEST_DIR" "$PORT" > /tmp/e2e-server-output.log 2>&1 &
SERVER_PID=$!

log_info "Server PID: ${SERVER_PID}"

# Wait for server to be ready (poll /api/health)
MAX_WAIT=30
WAITED=0
SERVER_READY=false

while (( WAITED < MAX_WAIT )); do
  if curl -sf "http://localhost:${PORT}/api/health" > /dev/null 2>&1; then
    SERVER_READY=true
    break
  fi
  sleep 1
  WAITED=$(( WAITED + 1 ))
done

if $SERVER_READY; then
  log_pass "server responded to /api/health within ${WAITED}s"
else
  log_fail "server failed to respond within ${MAX_WAIT}s"
  # Dump server output for debugging
  if [[ -f /tmp/e2e-server-output.log ]]; then
    log_info "Server output (last 20 lines):"
    tail -20 /tmp/e2e-server-output.log 2>/dev/null || true
  fi
  DIM_ELAPSED="$(stop_timer "$DIM_START")"
  write_result_json "$DIM_NAME" "$DIM_ELAPSED"
  exit 1
fi

# ─── Test /api/health ────────────────────────────────────────────────────────

log_section "API: /api/health"

HEALTH_RESPONSE="$(curl -sf "http://localhost:${PORT}/api/health" 2>/dev/null)" || HEALTH_RESPONSE=""

if [[ -n "$HEALTH_RESPONSE" ]]; then
  log_pass "/api/health returns response"

  # Verify it's valid JSON
  if echo "$HEALTH_RESPONSE" | jq empty 2>/dev/null; then
    log_pass "/api/health returns valid JSON"
  else
    log_fail "/api/health returns valid JSON" "not valid JSON: ${HEALTH_RESPONSE}"
  fi

  # Verify status field
  health_status="$(echo "$HEALTH_RESPONSE" | jq -r '.status' 2>/dev/null)" || health_status=""
  assert_eq "$health_status" "ok" "/api/health status = ok"
else
  log_fail "/api/health returns response" "empty response"
fi

# ─── Test /api/state ─────────────────────────────────────────────────────────

log_section "API: /api/state"

STATE_RESPONSE="$(curl -sf "http://localhost:${PORT}/api/state" 2>/dev/null)" || STATE_RESPONSE=""

if [[ -n "$STATE_RESPONSE" ]]; then
  log_pass "/api/state returns response"

  if echo "$STATE_RESPONSE" | jq empty 2>/dev/null; then
    log_pass "/api/state returns valid JSON"
  else
    log_fail "/api/state returns valid JSON" "not valid JSON"
  fi

  # Check for expected top-level fields (agents or directives)
  has_fields=false
  if echo "$STATE_RESPONSE" | jq -e 'has("agents") or has("directives") or has("sessions")' > /dev/null 2>&1; then
    has_fields=true
  fi
  if $has_fields; then
    log_pass "/api/state has expected fields (agents/directives/sessions)"
  else
    log_fail "/api/state has expected fields" "missing agents/directives/sessions keys"
  fi
else
  log_fail "/api/state returns response" "empty response"
fi

# ─── Test Dashboard HTML ─────────────────────────────────────────────────────

log_section "Dashboard: GET /"

DASHBOARD_RESPONSE="$(curl -sf "http://localhost:${PORT}/" 2>/dev/null)" || DASHBOARD_RESPONSE=""

if [[ -n "$DASHBOARD_RESPONSE" ]]; then
  log_pass "GET / returns response"

  # Check for HTML
  assert_contains "$DASHBOARD_RESPONSE" "<html" "GET / returns HTML"

  # Check for root div (React mount point)
  if echo "$DASHBOARD_RESPONSE" | grep -q 'id="root"\|id="app"\|<div id=' 2>/dev/null; then
    log_pass "GET / contains root div"
  else
    log_fail "GET / contains root div" "no root div found in HTML"
  fi
else
  log_fail "GET / returns response" "empty response"
fi

# ─── Write results ───────────────────────────────────────────────────────────

DIM_ELAPSED="$(stop_timer "$DIM_START")"
write_result_json "$DIM_NAME" "$DIM_ELAPSED"

log_section "dim-server results"
printf "  Pass: %d  Fail: %d  Time: %d ms\n\n" "$_PASS_COUNT" "$_FAIL_COUNT" "$DIM_ELAPSED"

if (( _FAIL_COUNT > 0 )); then
  exit 1
fi
