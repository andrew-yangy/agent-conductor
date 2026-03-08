#!/usr/bin/env bash
# ─── Benchmark Utilities ────────────────────────────────────────────────────
#
# Shared helpers for the agent benchmark suite (dim-agent-benchmark.sh).
# Provides fixture management, directive scaffolding, timing, and result output.
#
# Usage: source this file after lib/utils.sh from dim-agent-benchmark.sh.
#
# Compatible with bash 3.2+ (macOS default).
# ─────────────────────────────────────────────────────────────────────────────

# ─── Fixture Management ─────────────────────────────────────────────────────

# reset_fixture — creates a clean temp project dir, returns path via stdout
reset_fixture() {
  local label="${1:-benchmark}"
  local dir
  dir="$(create_test_dir "e2e-test-${label}")"
  echo "$dir"
}

# scaffold_config <project_dir> <preset> — inits with the given preset, returns 0 on success
# Populates the project dir with gru-ai init using the specified preset.
scaffold_config() {
  local project_dir="$1"
  local preset="$2"
  local output
  output="$(run_gruai_init "$project_dir" "$preset" 2>&1)" || true

  # Verify init produced .gruai/ directory
  if [[ -d "${project_dir}/.gruai" ]]; then
    return 0
  else
    log_fail "scaffold_config(${preset}): .gruai/ not created"
    return 1
  fi
}

# get_expected_agent_count <preset> — returns expected agent count (agents + CEO)
get_expected_agent_count() {
  case "$1" in
    starter)  echo 5 ;;
    standard) echo 8 ;;
    full)     echo 12 ;;
    *)        echo 0 ;;
  esac
}

# verify_agent_count <project_dir> <preset> — checks registry has correct agent count
verify_agent_count() {
  local project_dir="$1"
  local preset="$2"
  local registry="${project_dir}/.gruai/agent-registry.json"
  local expected
  expected="$(get_expected_agent_count "$preset")"

  if [[ ! -f "$registry" ]]; then
    log_fail "${preset}: agent-registry.json not found"
    return 1
  fi

  if ! command -v jq &>/dev/null; then
    log_fail "${preset}: jq not available for agent count verification"
    return 1
  fi

  local actual
  actual="$(jq '.agents | length' "$registry" 2>/dev/null)" || {
    log_fail "${preset}: failed to parse agent-registry.json"
    return 1
  }

  assert_eq "$actual" "$expected" "${preset}: agent count = ${expected}"
}

# ─── Directive Scaffolding ───────────────────────────────────────────────────

# create_directive <dir> <id> <title> <scope>
# Creates a directive structure in a project's .context/directives/ directory.
# Produces directive.json + directive.md with minimal valid content.
create_directive() {
  local project_dir="$1"
  local directive_id="$2"
  local title="$3"
  local scope="$4"

  local directives_root="${project_dir}/.context/directives"
  local directive_dir="${directives_root}/${directive_id}"

  mkdir -p "$directive_dir"

  # Write directive.json
  cat > "${directive_dir}/directive.json" <<ENDJSON
{
  "id": "${directive_id}",
  "title": "${title}",
  "weight": "lightweight",
  "status": "pending",
  "pipeline": {
    "current_step": "triage",
    "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  },
  "scope": {
    "description": "${scope}",
    "in": [],
    "out": []
  }
}
ENDJSON

  # Write directive.md
  cat > "${directive_dir}/directive.md" <<ENDMD
# ${title}

## Scope
${scope}

## Context
This directive was created by the agent benchmark suite for testing purposes.
ENDMD
}

# create_directive_with_project <dir> <id> <title> <scope> <task_title>
# Creates a directive AND a project under it with a single task.
create_directive_with_project() {
  local project_dir="$1"
  local directive_id="$2"
  local title="$3"
  local scope="$4"
  local task_title="$5"

  # Create the directive first
  create_directive "$project_dir" "$directive_id" "$title" "$scope"

  # Create a project under the directive
  local project_path="${project_dir}/.context/directives/${directive_id}/projects/${directive_id}"
  mkdir -p "$project_path"

  cat > "${project_path}/project.json" <<ENDJSON
{
  "id": "${directive_id}",
  "title": "${title}",
  "status": "pending",
  "agent": ["fullstack"],
  "reviewers": ["qa"],
  "tasks": [
    {
      "id": "task-1",
      "title": "${task_title}",
      "status": "pending",
      "agent": ["fullstack"],
      "dod": [
        { "criterion": "${scope}", "met": false }
      ]
    }
  ]
}
ENDJSON
}

# validate_directive_structure <dir> <id>
# Checks that a directive has the required files and valid JSON.
# Returns 0 if valid, 1 if not.
validate_directive_structure() {
  local project_dir="$1"
  local directive_id="$2"
  local prefix="${3:-${directive_id}}"

  local directive_dir="${project_dir}/.context/directives/${directive_id}"

  # Check directive directory exists
  assert_dir_exists "$directive_dir" "${prefix}: directive directory exists"

  # Check directive.json exists and is valid JSON
  local json_file="${directive_dir}/directive.json"
  assert_file_exists "$json_file" "${prefix}: directive.json exists"
  if [[ -f "$json_file" ]]; then
    assert_json_valid "$json_file" "${prefix}: directive.json is valid JSON"
    assert_json_field "$json_file" '.id' "$directive_id" "${prefix}: directive.json id matches"
    assert_json_field "$json_file" '.status' "pending" "${prefix}: directive.json status = pending"
  fi

  # Check directive.md exists and is non-empty
  assert_file_not_empty "${directive_dir}/directive.md" "${prefix}: directive.md exists and non-empty"
}

# validate_project_structure <dir> <directive_id>
# Checks that a project under a directive has valid structure.
validate_project_structure() {
  local project_dir="$1"
  local directive_id="$2"
  local prefix="${3:-${directive_id}}"

  local project_path="${project_dir}/.context/directives/${directive_id}/projects/${directive_id}"

  assert_dir_exists "$project_path" "${prefix}: project directory exists"

  local project_json="${project_path}/project.json"
  assert_file_exists "$project_json" "${prefix}: project.json exists"
  if [[ -f "$project_json" ]]; then
    assert_json_valid "$project_json" "${prefix}: project.json is valid JSON"
    assert_json_field "$project_json" '.status' "pending" "${prefix}: project.json status = pending"
  fi
}

# ─── Benchmark Timing ────────────────────────────────────────────────────────

# BENCH_TIMING_* — accumulate timing entries as indexed variables
BENCH_TIMING_COUNT=0

# timing_start — captures current time, echoes ms value
timing_start() {
  start_timer
}

# timing_stop <start_ms> — echoes elapsed ms
timing_stop() {
  stop_timer "$1"
}

# timing_record <label> <duration_ms> <status>
# Records a timing entry for later reporting.
timing_record() {
  local label="$1" duration_ms="$2" status="$3"
  eval "BENCH_TIMING_${BENCH_TIMING_COUNT}=\"${label}|${duration_ms}|${status}\""
  BENCH_TIMING_COUNT=$(( BENCH_TIMING_COUNT + 1 ))
}

# timing_report — prints a timing table to stdout
timing_report() {
  printf "\n  ${C_BOLD}%-40s %12s %8s${C_RESET}\n" "BENCHMARK" "DURATION" "STATUS"
  printf "  %-40s %12s %8s\n" "----------------------------------------" "------------" "--------"

  local i=0
  while (( i < BENCH_TIMING_COUNT )); do
    eval "entry=\"\$BENCH_TIMING_${i}\""
    IFS='|' read -r label dur stat <<< "$entry"
    printf "  %-40s %9s ms %8s\n" "$label" "$dur" "$stat"
    i=$(( i + 1 ))
  done
  printf "\n"
}

# ─── Result Output ───────────────────────────────────────────────────────────

# BENCH_RESULT_* — per-run results as indexed variables
BENCH_RESULT_COUNT=0

# record_benchmark_result <type> <config> <directive_id> <pass_count> <fail_count> <duration_ms>
record_benchmark_result() {
  local btype="$1" config="$2" directive_id="$3" passes="$4" fails="$5" duration_ms="$6"
  local status="pass"
  if (( fails > 0 )); then status="fail"; fi
  eval "BENCH_RESULT_${BENCH_RESULT_COUNT}=\"${btype}|${config}|${directive_id}|${passes}|${fails}|${status}|${duration_ms}\""
  BENCH_RESULT_COUNT=$(( BENCH_RESULT_COUNT + 1 ))
}

# write_benchmark_json <type> <output_file>
# Writes all recorded benchmark results for the given type to a JSON file.
write_benchmark_json() {
  local btype="$1"
  local output_file="$2"

  local json_array="["
  local first=true
  local i=0
  while (( i < BENCH_RESULT_COUNT )); do
    eval "entry=\"\$BENCH_RESULT_${i}\""
    IFS='|' read -r t config dir_id passes fails status dur <<< "$entry"
    if [[ "$t" == "$btype" ]]; then
      if $first; then first=false; else json_array+=","; fi
      json_array+="{\"config\":\"${config}\",\"directive\":\"${dir_id}\",\"pass_count\":${passes},\"fail_count\":${fails},\"status\":\"${status}\",\"duration_ms\":${dur}}"
    fi
    i=$(( i + 1 ))
  done
  json_array+="]"

  cat > "$output_file" <<ENDJSON
{
  "benchmark_type": "${btype}",
  "results": ${json_array},
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
ENDJSON
}

# write_combined_summary <results_dir>
# Merges all benchmark type results into a single summary.json.
write_combined_summary() {
  local results_dir="$1"

  # Collect all per-type JSON files
  local types_json="["
  local first=true
  for f in "${results_dir}"/benchmark-*.json; do
    if [[ -f "$f" ]]; then
      if $first; then first=false; else types_json+=","; fi
      types_json+="$(cat "$f")"
    fi
  done
  types_json+="]"

  # Overall counts
  local total_pass=0 total_fail=0 total_runs=0
  local i=0
  while (( i < BENCH_RESULT_COUNT )); do
    eval "entry=\"\$BENCH_RESULT_${i}\""
    IFS='|' read -r t config dir_id passes fails status dur <<< "$entry"
    total_pass=$(( total_pass + passes ))
    total_fail=$(( total_fail + fails ))
    total_runs=$(( total_runs + 1 ))
    i=$(( i + 1 ))
  done

  cat > "${results_dir}/summary.json" <<ENDJSON
{
  "total_runs": ${total_runs},
  "total_pass": ${total_pass},
  "total_fail": ${total_fail},
  "status": "$(if (( total_fail == 0 )); then echo pass; else echo fail; fi)",
  "benchmarks": ${types_json},
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
ENDJSON
}

# ─── Artifact Copying ────────────────────────────────────────────────────────

# copy_artifacts <source_project_dir> <results_dir> <label>
# Copies .context/directives/ content to results for CEO inspection.
copy_artifacts() {
  local source_dir="$1"
  local results_dir="$2"
  local label="$3"

  local artifact_dir="${results_dir}/artifacts/${label}"
  mkdir -p "$artifact_dir"

  if [[ -d "${source_dir}/.context/directives" ]]; then
    cp -r "${source_dir}/.context/directives" "${artifact_dir}/directives" 2>/dev/null || true
  fi

  if [[ -f "${source_dir}/gruai.config.json" ]]; then
    cp "${source_dir}/gruai.config.json" "${artifact_dir}/" 2>/dev/null || true
  fi
}
