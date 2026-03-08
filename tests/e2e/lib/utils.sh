#!/usr/bin/env bash
# ─── E2E Test Shared Library ─────────────────────────────────────────────────
#
# Provides assertion helpers, timing, port allocation, temp-dir management,
# and JSON result output for all dimension scripts.
#
# Usage: source this file from each dim-*.sh script.
#
# Compatible with bash 3.2+ (macOS default).
# ──────────────────────────────────────────────────────────────────────────────

# ─── Colors ──────────────────────────────────────────────────────────────────

if [[ -t 1 ]] || [[ "${FORCE_COLOR:-}" == "1" ]]; then
  C_GREEN='\033[0;32m'
  C_RED='\033[0;31m'
  C_YELLOW='\033[0;33m'
  C_CYAN='\033[0;36m'
  C_BOLD='\033[1m'
  C_DIM='\033[2m'
  C_RESET='\033[0m'
else
  C_GREEN='' C_RED='' C_YELLOW='' C_CYAN='' C_BOLD='' C_DIM='' C_RESET=''
fi

# ─── Counters ────────────────────────────────────────────────────────────────

_PASS_COUNT=0
_FAIL_COUNT=0
# Store fail messages as newline-delimited string (bash 3 compatible)
_FAIL_MESSAGES_STR=""

# ─── Logging ─────────────────────────────────────────────────────────────────

log_pass() {
  local msg="$1"
  _PASS_COUNT=$(( _PASS_COUNT + 1 ))
  printf "  ${C_GREEN}PASS${C_RESET}  %s\n" "$msg"
}

log_fail() {
  local msg="$1"
  local detail="${2:-}"
  _FAIL_COUNT=$(( _FAIL_COUNT + 1 ))
  if [[ -n "$_FAIL_MESSAGES_STR" ]]; then
    _FAIL_MESSAGES_STR="${_FAIL_MESSAGES_STR}
${msg}"
  else
    _FAIL_MESSAGES_STR="$msg"
  fi
  printf "  ${C_RED}FAIL${C_RESET}  %s\n" "$msg"
  if [[ -n "$detail" ]]; then
    printf "        ${C_DIM}%s${C_RESET}\n" "$detail"
  fi
}

log_info() {
  printf "  ${C_CYAN}INFO${C_RESET}  %s\n" "$1"
}

log_section() {
  printf "\n${C_BOLD}── %s ──${C_RESET}\n\n" "$1"
}

# ─── Assertions ──────────────────────────────────────────────────────────────

# assert_eq <actual> <expected> <message>
assert_eq() {
  local actual="$1" expected="$2" msg="$3"
  if [[ "$actual" == "$expected" ]]; then
    log_pass "$msg"
  else
    log_fail "$msg" "expected '$expected', got '$actual'"
  fi
}

# assert_contains <haystack> <needle> <message>
assert_contains() {
  local haystack="$1" needle="$2" msg="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    log_pass "$msg"
  else
    log_fail "$msg" "string does not contain '$needle'"
  fi
}

# assert_file_exists <path> <message>
assert_file_exists() {
  local filepath="$1" msg="$2"
  if [[ -e "$filepath" ]]; then
    log_pass "$msg"
  else
    log_fail "$msg" "file not found: $filepath"
  fi
}

# assert_file_not_empty <path> <message>
assert_file_not_empty() {
  local filepath="$1" msg="$2"
  if [[ -s "$filepath" ]]; then
    log_pass "$msg"
  else
    log_fail "$msg" "file is empty or missing: $filepath"
  fi
}

# assert_dir_exists <path> <message>
assert_dir_exists() {
  local dirpath="$1" msg="$2"
  if [[ -d "$dirpath" ]]; then
    log_pass "$msg"
  else
    log_fail "$msg" "directory not found: $dirpath"
  fi
}

# assert_symlink <path> <target> <message>
assert_symlink() {
  local linkpath="$1" target="$2" msg="$3"
  if [[ -L "$linkpath" ]]; then
    local actual_target
    actual_target="$(readlink "$linkpath")"
    if [[ "$actual_target" == "$target" ]]; then
      log_pass "$msg"
    else
      log_fail "$msg" "symlink target: expected '$target', got '$actual_target'"
    fi
  else
    log_fail "$msg" "not a symlink: $linkpath"
  fi
}

# assert_json_field <file> <jq_expression> <expected_value> <message>
# Requires jq to be installed.
assert_json_field() {
  local file="$1" jq_expr="$2" expected="$3" msg="$4"
  if ! command -v jq &>/dev/null; then
    log_fail "$msg" "jq is not installed"
    return
  fi
  if [[ ! -f "$file" ]]; then
    log_fail "$msg" "file not found: $file"
    return
  fi
  local actual
  actual="$(jq -r "$jq_expr" "$file" 2>/dev/null)" || {
    log_fail "$msg" "jq parse error on $file"
    return
  }
  if [[ "$actual" == "$expected" ]]; then
    log_pass "$msg"
  else
    log_fail "$msg" "expected '$expected', got '$actual'"
  fi
}

# assert_json_valid <file> <message>
assert_json_valid() {
  local file="$1" msg="$2"
  if ! command -v jq &>/dev/null; then
    # Fallback: try python
    if python3 -c "import json; json.load(open('$file'))" 2>/dev/null; then
      log_pass "$msg"
    else
      log_fail "$msg" "invalid JSON in $file (no jq, python3 fallback failed)"
    fi
    return
  fi
  if jq empty "$file" 2>/dev/null; then
    log_pass "$msg"
  else
    log_fail "$msg" "invalid JSON in $file"
  fi
}

# assert_gt <actual_num> <threshold> <message>
assert_gt() {
  local actual="$1" threshold="$2" msg="$3"
  if (( actual > threshold )); then
    log_pass "$msg"
  else
    log_fail "$msg" "expected > $threshold, got $actual"
  fi
}

# ─── Port Allocation ────────────────────────────────────────────────────────

# find_free_port — outputs a free port in range 10000-60000
find_free_port() {
  local port
  local i=0
  while (( i < 50 )); do
    port=$(( RANDOM % 50000 + 10000 ))
    if ! lsof -i :"$port" &>/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
    i=$(( i + 1 ))
  done
  # Fallback: let the OS pick
  echo "0"
  return 1
}

# ─── Temp Directory Management ──────────────────────────────────────────────

# create_test_dir — creates a temp dir and outputs the path
create_test_dir() {
  local prefix="${1:-e2e-test}"
  mktemp -d "${TMPDIR:-/tmp}/${prefix}.XXXXXXXX"
}

# cleanup_test_dir <path> — safely removes a temp dir
cleanup_test_dir() {
  local dir="$1"
  if [[ -n "$dir" && -d "$dir" && "$dir" == *"e2e-test"* ]]; then
    rm -rf "$dir"
  fi
}

# ─── Timing ──────────────────────────────────────────────────────────────────

# start_timer — stores current time in epoch ms (macOS + Linux compatible)
start_timer() {
  if command -v gdate &>/dev/null; then
    gdate +%s%3N
  else
    # macOS date fallback: seconds * 1000
    echo $(( $(date +%s) * 1000 ))
  fi
}

# stop_timer <start_ms> — prints elapsed ms
stop_timer() {
  local start_ms="$1"
  local end_ms
  end_ms="$(start_timer)"
  echo $(( end_ms - start_ms ))
}

# ─── Result Output ───────────────────────────────────────────────────────────

# write_result_json <dim_name> <duration_ms>
# Writes JSON result to the results directory.
# Must be called at the end of each dimension script.
write_result_json() {
  local dim_name="$1"
  local duration_ms="$2"
  local results_dir="${E2E_RESULTS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/results}"

  mkdir -p "$results_dir"

  local status="pass"
  if (( _FAIL_COUNT > 0 )); then
    status="fail"
  fi

  # Build fail_list JSON array from newline-delimited string
  local fail_list="[]"
  if [[ -n "$_FAIL_MESSAGES_STR" ]]; then
    fail_list="["
    local first=true
    while IFS= read -r msg; do
      if [[ -z "$msg" ]]; then continue; fi
      if $first; then first=false; else fail_list+=","; fi
      # Escape quotes in message
      local escaped="${msg//\"/\\\"}"
      fail_list+="\"$escaped\""
    done <<< "$_FAIL_MESSAGES_STR"
    fail_list+="]"
  fi

  cat > "${results_dir}/dim-${dim_name}.json" <<ENDJSON
{
  "dimension": "${dim_name}",
  "status": "${status}",
  "pass_count": ${_PASS_COUNT},
  "fail_count": ${_FAIL_COUNT},
  "duration_ms": ${duration_ms},
  "failures": ${fail_list},
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
ENDJSON
}

# ─── Dimension Result Accessors ──────────────────────────────────────────────

get_pass_count() { echo "$_PASS_COUNT"; }
get_fail_count() { echo "$_FAIL_COUNT"; }

# ─── Init Helper ─────────────────────────────────────────────────────────────

# The gru-ai package root (where this repo lives)
GRUAI_PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"

# CLI entry point — use local dist-cli directly to avoid npm cache issues
GRUAI_CLI="${GRUAI_PACKAGE_ROOT}/dist-cli/index.js"

# run_gruai_init <project_dir> <preset> [platform]
# Runs gruai init non-interactively using --name, --preset, --yes flags.
run_gruai_init() {
  local project_dir="$1"
  local preset="$2"

  (
    cd "$project_dir" || exit 1
    node "$GRUAI_CLI" init \
      --name "test-project" \
      --preset "$preset" \
      --yes \
      2>&1
  )
}

# run_gruai_init_with_platform <project_dir> <preset> <platform>
run_gruai_init_with_platform() {
  local project_dir="$1"
  local preset="$2"
  local platform="$3"

  (
    cd "$project_dir" || exit 1
    node "$GRUAI_CLI" init \
      --name "test-project" \
      --preset "$preset" \
      --platform "$platform" \
      --yes \
      2>&1
  )
}

# run_gruai_start <project_dir> <port>
# Starts the gru-ai server on the given port. Runs in foreground.
run_gruai_start() {
  local project_dir="$1"
  local port="$2"

  (
    cd "$project_dir" || exit 1
    node "$GRUAI_CLI" start --port "$port" 2>&1
  )
}
