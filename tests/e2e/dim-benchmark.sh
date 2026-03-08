#!/usr/bin/env bash
set -euo pipefail

# ─── Dimension: Benchmark Timing Harness ─────────────────────────────────────
#
# Measures performance baselines:
# 1. Init time per preset (starter, standard, full)
# 2. Server cold-start time (time to first /api/health response)
# 3. Type-check time (npx tsc --noEmit in source repo)
#
# Outputs timing table to stdout and JSON to results/.
# Compatible with bash 3.2+ (macOS default).
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/utils.sh"

DIM_NAME="benchmark"
DIM_START="$(start_timer)"

TEMP_DIR_COUNT=0
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  local i=0
  while (( i < TEMP_DIR_COUNT )); do
    eval "cleanup_test_dir \"\$BENCH_TEMP_${i}\""
    i=$(( i + 1 ))
  done
}
trap cleanup EXIT

add_temp_dir() {
  eval "BENCH_TEMP_${TEMP_DIR_COUNT}=\"$1\""
  TEMP_DIR_COUNT=$(( TEMP_DIR_COUNT + 1 ))
}

# ─── Benchmark results accumulator ──────────────────────────────────────────
# Store as pipe-delimited lines (bash 3 compatible)

BENCH_COUNT=0

add_benchmark() {
  local operation="$1" duration_ms="$2" status="$3"
  eval "BENCH_ENTRY_${BENCH_COUNT}=\"${operation}|${duration_ms}|${status}\""
  BENCH_COUNT=$(( BENCH_COUNT + 1 ))
  log_pass "${operation}: ${duration_ms} ms (${status})"
}

# ─── Benchmark 1: Init timing per preset ────────────────────────────────────

log_section "Benchmark: init timing"

for preset in starter standard full; do
  test_dir="$(create_test_dir "e2e-test-bench-${preset}")"
  add_temp_dir "$test_dir"

  t_start="$(start_timer)"
  init_output="$(run_gruai_init "$test_dir" "$preset" 2>&1)" || true
  t_elapsed="$(stop_timer "$t_start")"

  # Verify init succeeded
  if [[ -d "${test_dir}/.gruai" ]]; then
    add_benchmark "init-${preset}" "$t_elapsed" "ok"
  else
    add_benchmark "init-${preset}" "$t_elapsed" "failed"
    log_fail "init-${preset} produced .gruai/" "init did not create .gruai/"
  fi
done

# ─── Benchmark 2: Server cold-start ─────────────────────────────────────────

log_section "Benchmark: server cold-start"

COLD_START_DIR="$(create_test_dir "e2e-test-bench-coldstart")"
add_temp_dir "$COLD_START_DIR"

# Init first
init_output="$(run_gruai_init "$COLD_START_DIR" "starter" 2>&1)" || true

PORT="$(find_free_port)"
log_info "Server port: ${PORT}"

t_start="$(start_timer)"

# Start server using local CLI
run_gruai_start "$COLD_START_DIR" "$PORT" > /tmp/e2e-bench-server.log 2>&1 &
SERVER_PID=$!

# Poll for readiness
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

t_elapsed="$(stop_timer "$t_start")"

if $SERVER_READY; then
  add_benchmark "server-cold-start" "$t_elapsed" "ok"
else
  add_benchmark "server-cold-start" "$t_elapsed" "timeout"
  log_fail "server cold-start" "did not respond within ${MAX_WAIT}s"
fi

# Kill server
if [[ -n "$SERVER_PID" ]]; then
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
fi

# ─── Benchmark 3: Type-check ────────────────────────────────────────────────

log_section "Benchmark: type-check"

t_start="$(start_timer)"
if (cd "$GRUAI_PACKAGE_ROOT" && npx tsc --noEmit 2>&1) > /dev/null 2>&1; then
  t_elapsed="$(stop_timer "$t_start")"
  add_benchmark "type-check" "$t_elapsed" "ok"
else
  t_elapsed="$(stop_timer "$t_start")"
  add_benchmark "type-check" "$t_elapsed" "error"
  log_fail "type-check completed without errors"
fi

# ─── Timing Table ────────────────────────────────────────────────────────────

log_section "Benchmark Results"

printf "  ${C_BOLD}%-25s %12s %8s${C_RESET}\n" "OPERATION" "DURATION" "STATUS"
printf "  %-25s %12s %8s\n" "-------------------------" "------------" "--------"

i=0
while (( i < BENCH_COUNT )); do
  eval "entry=\"\$BENCH_ENTRY_${i}\""
  IFS='|' read -r op dur stat <<< "$entry"
  printf "  %-25s %9s ms %8s\n" "$op" "$dur" "$stat"
  i=$(( i + 1 ))
done

printf "\n"

# ─── Write JSON results ─────────────────────────────────────────────────────

DIM_ELAPSED="$(stop_timer "$DIM_START")"

# Build benchmarks JSON array
BENCH_JSON="["
first=true
i=0
while (( i < BENCH_COUNT )); do
  eval "entry=\"\$BENCH_ENTRY_${i}\""
  IFS='|' read -r op dur stat <<< "$entry"
  if $first; then first=false; else BENCH_JSON+=","; fi
  BENCH_JSON+="{\"operation\":\"${op}\",\"duration_ms\":${dur},\"status\":\"${stat}\"}"
  i=$(( i + 1 ))
done
BENCH_JSON+="]"

# Write combined result
results_dir="${E2E_RESULTS_DIR:-${SCRIPT_DIR}/results}"
mkdir -p "$results_dir"

cat > "${results_dir}/dim-${DIM_NAME}.json" <<ENDJSON
{
  "dimension": "${DIM_NAME}",
  "status": "$(if (( _FAIL_COUNT == 0 )); then echo pass; else echo fail; fi)",
  "pass_count": ${_PASS_COUNT},
  "fail_count": ${_FAIL_COUNT},
  "duration_ms": ${DIM_ELAPSED},
  "benchmarks": ${BENCH_JSON},
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
ENDJSON

log_section "dim-benchmark results"
printf "  Pass: %d  Fail: %d  Time: %d ms\n\n" "$_PASS_COUNT" "$_FAIL_COUNT" "$DIM_ELAPSED"

if (( _FAIL_COUNT > 0 )); then
  exit 1
fi
