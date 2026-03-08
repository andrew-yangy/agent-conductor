#!/usr/bin/env bash
set -euo pipefail

# ─── E2E Test Orchestrator ───────────────────────────────────────────────────
#
# Discovers and runs dim-*.sh scripts, collects results, prints summary.
#
# Usage:
#   ./run-e2e.sh              # Run all dimensions
#   ./run-e2e.sh --dim init   # Run only dim-init.sh
#   ./run-e2e.sh --help       # Show help
#
# Compatible with bash 3.2+ (macOS default).
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"
export E2E_RESULTS_DIR="$RESULTS_DIR"

# Source shared library
source "${SCRIPT_DIR}/lib/utils.sh"

# ─── Help ────────────────────────────────────────────────────────────────────

print_help() {
  cat <<'EOF'
E2E Test Orchestrator for gru-ai

Usage:
  ./run-e2e.sh              Run all dimension tests
  ./run-e2e.sh --dim <name> Run a single dimension (e.g., init, server, schema)
  ./run-e2e.sh --list       List available dimensions
  ./run-e2e.sh --help       Show this help

Each dimension writes results to tests/e2e/results/dim-{name}.json.
Exit code: 0 if all pass, 1 if any fail.
EOF
}

# ─── Parse Arguments ─────────────────────────────────────────────────────────

DIM_FILTER=""
LIST_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dim)
      DIM_FILTER="$2"
      shift 2
      ;;
    --list)
      LIST_ONLY=true
      shift
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      print_help
      exit 1
      ;;
  esac
done

# ─── Discover Dimensions ────────────────────────────────────────────────────

# Store dimensions as space-delimited string (bash 3 compatible)
DIMENSIONS=""
DIM_COUNT=0

for script in "${SCRIPT_DIR}"/dim-*.sh; do
  if [[ -f "$script" ]]; then
    name="$(basename "$script" .sh)"
    name="${name#dim-}"
    if [[ -n "$DIMENSIONS" ]]; then
      DIMENSIONS="${DIMENSIONS} ${name}"
    else
      DIMENSIONS="$name"
    fi
    DIM_COUNT=$(( DIM_COUNT + 1 ))
  fi
done

if [[ $DIM_COUNT -eq 0 ]]; then
  echo "No dimension scripts found in ${SCRIPT_DIR}/dim-*.sh"
  exit 1
fi

if $LIST_ONLY; then
  echo "Available dimensions:"
  for dim in $DIMENSIONS; do
    echo "  - $dim"
  done
  exit 0
fi

# Filter to single dimension if --dim was specified
if [[ -n "$DIM_FILTER" ]]; then
  local_script="${SCRIPT_DIR}/dim-${DIM_FILTER}.sh"
  if [[ ! -f "$local_script" ]]; then
    echo "Dimension not found: ${DIM_FILTER}"
    echo "Available: ${DIMENSIONS}"
    exit 1
  fi
  DIMENSIONS="$DIM_FILTER"
  DIM_COUNT=1
fi

# ─── Prepare Results Directory ───────────────────────────────────────────────

rm -rf "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR"

# ─── Run Dimensions ─────────────────────────────────────────────────────────

TOTAL_START="$(start_timer)"
OVERALL_PASS=0
OVERALL_FAIL=0
RESULT_COUNT=0

printf "\n${C_BOLD}E2E Test Suite${C_RESET}\n"
printf "${C_DIM}Running %d dimension(s)...${C_RESET}\n" "$DIM_COUNT"

for dim in $DIMENSIONS; do
  script="${SCRIPT_DIR}/dim-${dim}.sh"

  printf "\n${C_BOLD}${C_CYAN}>> dim-${dim}${C_RESET}\n"

  dim_start="$(start_timer)"
  dim_exit=0

  # Run dimension script in a subshell so its set -e doesn't kill us
  if bash "$script"; then
    dim_exit=0
  else
    dim_exit=$?
  fi

  dim_elapsed="$(stop_timer "$dim_start")"

  # Read result JSON if it was written
  result_file="${RESULTS_DIR}/dim-${dim}.json"
  if [[ -f "$result_file" ]] && command -v jq &>/dev/null; then
    dim_pass="$(jq -r '.pass_count' "$result_file")"
    dim_fail="$(jq -r '.fail_count' "$result_file")"
    dim_status="$(jq -r '.status' "$result_file")"
  else
    if [[ $dim_exit -eq 0 ]]; then
      dim_pass=0; dim_fail=0; dim_status="pass"
    else
      dim_pass=0; dim_fail=1; dim_status="fail"
    fi
  fi

  OVERALL_PASS=$(( OVERALL_PASS + dim_pass ))
  OVERALL_FAIL=$(( OVERALL_FAIL + dim_fail ))

  # Store result entry using indexed variables
  eval "DIM_RESULT_${RESULT_COUNT}=\"${dim}|${dim_pass}|${dim_fail}|${dim_status}|${dim_elapsed}\""
  RESULT_COUNT=$(( RESULT_COUNT + 1 ))
done

TOTAL_ELAPSED="$(stop_timer "$TOTAL_START")"

# ─── Summary Table ───────────────────────────────────────────────────────────

printf "\n${C_BOLD}═══════════════════════════════════════════════════════════${C_RESET}\n"
printf "${C_BOLD}  E2E Test Summary${C_RESET}\n"
printf "${C_BOLD}═══════════════════════════════════════════════════════════${C_RESET}\n\n"

printf "  ${C_BOLD}%-20s %6s %6s %8s %10s${C_RESET}\n" "DIMENSION" "PASS" "FAIL" "STATUS" "TIME"
printf "  %-20s %6s %6s %8s %10s\n" "--------------------" "------" "------" "--------" "----------"

i=0
while (( i < RESULT_COUNT )); do
  eval "entry=\"\$DIM_RESULT_${i}\""
  IFS='|' read -r name pass fail status elapsed <<< "$entry"
  if [[ "$status" == "pass" ]]; then
    status_display="${C_GREEN}PASS${C_RESET}"
  else
    status_display="${C_RED}FAIL${C_RESET}"
  fi
  printf "  %-20s %6s %6s   ${status_display}   %7s ms\n" "$name" "$pass" "$fail" "$elapsed"
  i=$(( i + 1 ))
done

printf "\n  %-20s %6s %6s %8s %10s\n" "--------------------" "------" "------" "--------" "----------"

if (( OVERALL_FAIL == 0 )); then
  total_status="${C_GREEN}${C_BOLD}ALL PASS${C_RESET}"
else
  total_status="${C_RED}${C_BOLD}FAILED${C_RESET}"
fi

printf "  ${C_BOLD}%-20s %6s %6s${C_RESET}   ${total_status}   %7s ms\n" "TOTAL" "$OVERALL_PASS" "$OVERALL_FAIL" "$TOTAL_ELAPSED"
printf "\n"

# Write overall summary JSON
cat > "${RESULTS_DIR}/summary.json" <<ENDJSON
{
  "total_pass": ${OVERALL_PASS},
  "total_fail": ${OVERALL_FAIL},
  "total_duration_ms": ${TOTAL_ELAPSED},
  "dimensions": ${RESULT_COUNT},
  "status": "$(if (( OVERALL_FAIL == 0 )); then echo pass; else echo fail; fi)",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
ENDJSON

# Exit code
if (( OVERALL_FAIL > 0 )); then
  exit 1
fi
exit 0
