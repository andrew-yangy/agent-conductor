#!/usr/bin/env bash
set -euo pipefail

# ─── Dimension: Agent Benchmark Suite ────────────────────────────────────────
#
# Tests framework scaffolding for 3 benchmark types:
#   1. Bug-fix: 5 directives x 3 configs = 15 runs
#   2. Landing page: spec + directive structure x 3 configs
#   3. Improve: polish spec + directive structure x 3 configs
#
# Usage:
#   ./dim-agent-benchmark.sh                           # Run all types, all configs
#   ./dim-agent-benchmark.sh --type bugfix             # Bug-fix only, all configs
#   ./dim-agent-benchmark.sh --type landing-page       # Landing page only
#   ./dim-agent-benchmark.sh --type improve            # Improve only
#   ./dim-agent-benchmark.sh --type all                # All types (default)
#   ./dim-agent-benchmark.sh --config starter          # All types, starter only
#   ./dim-agent-benchmark.sh --type bugfix --config standard
#
# Compatible with bash 3.2+ (macOS default).
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/utils.sh"
source "${SCRIPT_DIR}/lib/benchmark-utils.sh"

DIM_NAME="agent-benchmark"
DIM_START="$(start_timer)"

RESULTS_DIR="${E2E_RESULTS_DIR:-${SCRIPT_DIR}/results}"
BENCHMARK_RESULTS_DIR="${RESULTS_DIR}/agent-benchmark"
mkdir -p "$BENCHMARK_RESULTS_DIR"

# ─── Parse Arguments ─────────────────────────────────────────────────────────

BENCH_TYPE="all"
BENCH_CONFIG="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      BENCH_TYPE="$2"
      shift 2
      ;;
    --config)
      BENCH_CONFIG="$2"
      shift 2
      ;;
    --help|-h)
      cat <<'EOF'
Agent Benchmark Suite

Usage:
  ./dim-agent-benchmark.sh [--type TYPE] [--config CONFIG]

Types: bugfix, landing-page, improve, all (default)
Configs: starter, standard, full, all (default)

Examples:
  ./dim-agent-benchmark.sh --type bugfix --config starter
  ./dim-agent-benchmark.sh --type all --config all
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Validate type
case "$BENCH_TYPE" in
  bugfix|landing-page|improve|all) ;;
  *)
    echo "Invalid --type: $BENCH_TYPE (must be bugfix, landing-page, improve, or all)"
    exit 1
    ;;
esac

# Validate config
case "$BENCH_CONFIG" in
  starter|standard|full|all) ;;
  *)
    echo "Invalid --config: $BENCH_CONFIG (must be starter, standard, full, or all)"
    exit 1
    ;;
esac

# Build config list
CONFIGS=""
if [[ "$BENCH_CONFIG" == "all" ]]; then
  CONFIGS="starter standard full"
else
  CONFIGS="$BENCH_CONFIG"
fi

# ─── Temp dir tracking ──────────────────────────────────────────────────────

TEMP_DIR_COUNT=0

cleanup() {
  local i=0
  while (( i < TEMP_DIR_COUNT )); do
    eval "cleanup_test_dir \"\$BENCH_TMP_${i}\""
    i=$(( i + 1 ))
  done
}
trap cleanup EXIT

add_bench_temp_dir() {
  eval "BENCH_TMP_${TEMP_DIR_COUNT}=\"$1\""
  TEMP_DIR_COUNT=$(( TEMP_DIR_COUNT + 1 ))
}

# ─── Bug-fix Directives ─────────────────────────────────────────────────────
# 5 test directives with bug-fix scopes

BUGFIX_COUNT=5

BUGFIX_ID_0="fix-login-validation"
BUGFIX_TITLE_0="Fix Login Form Validation Bug"
BUGFIX_SCOPE_0="The login form accepts empty email and password fields without showing validation errors. Add client-side validation that checks for non-empty email (valid format) and password (min 8 chars) before form submission."
BUGFIX_TASK_0="Add email format and password length validation to login form"

BUGFIX_ID_1="fix-api-error-handling"
BUGFIX_TITLE_1="Fix Missing API Error Handler"
BUGFIX_SCOPE_1="The /api/todos endpoint returns a raw 500 error with stack trace when the database connection fails. Add proper error handling middleware that returns a JSON error response with appropriate status codes."
BUGFIX_TASK_1="Add error handling middleware for /api/todos endpoint"

BUGFIX_ID_2="fix-css-overflow"
BUGFIX_TITLE_2="Fix CSS Layout Overflow Bug"
BUGFIX_SCOPE_2="Todo items with long text overflow their container on mobile viewports (below 480px). The text should truncate with ellipsis or wrap properly within the card bounds."
BUGFIX_TASK_2="Fix text overflow in todo item cards on mobile"

BUGFIX_ID_3="fix-data-persistence"
BUGFIX_TITLE_3="Fix Data Persistence Bug"
BUGFIX_SCOPE_3="Completed todos revert to incomplete state after page refresh because the toggle handler updates the UI but does not persist the change to localStorage. Fix the toggle handler to save state."
BUGFIX_TASK_3="Persist todo completion state to localStorage on toggle"

BUGFIX_ID_4="fix-race-condition"
BUGFIX_TITLE_4="Fix Race Condition in Async Todo Loading"
BUGFIX_SCOPE_4="Rapidly switching between todo categories causes stale data to display because previous fetch responses arrive after newer ones. Add request cancellation or sequence checking to prevent stale renders."
BUGFIX_TASK_4="Add fetch cancellation to prevent stale todo list renders"

# ─── Bug-fix Benchmark Runner ───────────────────────────────────────────────

run_bugfix_benchmark() {
  log_section "Benchmark Type: Bug-Fix (5 directives x configs)"

  for config in $CONFIGS; do
    log_section "Bug-Fix / Config: ${config}"

    local d=0
    while (( d < BUGFIX_COUNT )); do
      # Read directive data from indexed variables
      eval "local dir_id=\"\$BUGFIX_ID_${d}\""
      eval "local dir_title=\"\$BUGFIX_TITLE_${d}\""
      eval "local dir_scope=\"\$BUGFIX_SCOPE_${d}\""
      eval "local dir_task=\"\$BUGFIX_TASK_${d}\""

      local label="${config}-${dir_id}"
      local prefix="bugfix/${label}"

      log_info "Running: ${prefix}"

      # Save/restore pass/fail counts for this run
      local run_pass_before=$_PASS_COUNT
      local run_fail_before=$_FAIL_COUNT

      local t_start
      t_start="$(timing_start)"

      # 1. Reset fixture
      local test_dir
      test_dir="$(reset_fixture "${label}")"
      add_bench_temp_dir "$test_dir"

      # 2. Scaffold config
      scaffold_config "$test_dir" "$config"

      # 3. Verify agent count
      verify_agent_count "$test_dir" "$config"

      # 4. Create test directive with bug-fix scope
      create_directive_with_project "$test_dir" "$dir_id" "$dir_title" "$dir_scope" "$dir_task"

      # 5. Validate directive structure
      validate_directive_structure "$test_dir" "$dir_id" "$prefix"

      # 6. Validate project structure
      validate_project_structure "$test_dir" "$dir_id" "$prefix"

      # 7. Validate pipeline fields in directive.json
      local djson="${test_dir}/.context/directives/${dir_id}/directive.json"
      if [[ -f "$djson" ]]; then
        assert_json_field "$djson" '.pipeline.current_step' "triage" "${prefix}: pipeline.current_step = triage"
        assert_json_field "$djson" '.weight' "lightweight" "${prefix}: weight = lightweight"
      fi

      local t_elapsed
      t_elapsed="$(timing_stop "$t_start")"

      # Record per-run results
      local run_passes=$(( _PASS_COUNT - run_pass_before ))
      local run_fails=$(( _FAIL_COUNT - run_fail_before ))
      record_benchmark_result "bugfix" "$config" "$dir_id" "$run_passes" "$run_fails" "$t_elapsed"
      timing_record "${prefix}" "$t_elapsed" "$(if (( run_fails == 0 )); then echo ok; else echo fail; fi)"

      # 8. Copy artifacts for inspection
      copy_artifacts "$test_dir" "$BENCHMARK_RESULTS_DIR" "$label"

      d=$(( d + 1 ))
    done
  done

  # Write bugfix results JSON
  write_benchmark_json "bugfix" "${BENCHMARK_RESULTS_DIR}/benchmark-bugfix.json"
  log_info "Bug-fix results written to ${BENCHMARK_RESULTS_DIR}/benchmark-bugfix.json"
}

# ─── Landing Page Benchmark Runner ──────────────────────────────────────────

run_landing_page_benchmark() {
  log_section "Benchmark Type: Landing Page (spec + directive structure x configs)"

  local spec_file="${SCRIPT_DIR}/specs/landing-page-spec.md"
  assert_file_not_empty "$spec_file" "landing-page: spec file exists"

  for config in $CONFIGS; do
    local label="landing-page-${config}"
    local prefix="landing-page/${config}"

    log_info "Running: ${prefix}"

    local run_pass_before=$_PASS_COUNT
    local run_fail_before=$_FAIL_COUNT

    local t_start
    t_start="$(timing_start)"

    # 1. Reset fixture
    local test_dir
    test_dir="$(reset_fixture "${label}")"
    add_bench_temp_dir "$test_dir"

    # 2. Scaffold config
    scaffold_config "$test_dir" "$config"

    # 3. Verify agent count
    verify_agent_count "$test_dir" "$config"

    # 4. Create landing-page directive
    local dir_id="build-landing-page"
    create_directive "$test_dir" "$dir_id" \
      "Build gruai Landing Page" \
      "Build a single-page landing page with pixel art/retro game aesthetic. See spec for full requirements."

    # 5. Copy spec into the directive directory
    local directive_dir="${test_dir}/.context/directives/${dir_id}"
    cp "$spec_file" "${directive_dir}/landing-page-spec.md"
    assert_file_not_empty "${directive_dir}/landing-page-spec.md" "${prefix}: spec copied into directive"

    # 6. Create project under the directive
    local project_path="${directive_dir}/projects/${dir_id}"
    mkdir -p "$project_path"

    cat > "${project_path}/project.json" <<ENDJSON
{
  "id": "${dir_id}",
  "title": "Build gruai Landing Page",
  "status": "pending",
  "agent": ["frontend"],
  "reviewers": ["qa", "cpo"],
  "tasks": [
    {
      "id": "build-html",
      "title": "Create single-file landing page with pixel art aesthetic",
      "status": "pending",
      "agent": ["frontend"],
      "dod": [
        { "criterion": "Single self-contained HTML file with all CSS/JS inline", "met": false },
        { "criterion": "Hero section with animated pixel art and CTA", "met": false },
        { "criterion": "Features grid with 6 feature cards", "met": false },
        { "criterion": "How It Works 3-step flow", "met": false },
        { "criterion": "Agent Showcase with pixel art characters", "met": false },
        { "criterion": "Pricing/Plans with 3 tiers", "met": false },
        { "criterion": "Footer CTA with links", "met": false },
        { "criterion": "Responsive design (mobile/tablet/desktop)", "met": false },
        { "criterion": "8-bit color palette and pixel art CSS techniques", "met": false }
      ]
    }
  ]
}
ENDJSON

    # 7. Validate directive structure
    validate_directive_structure "$test_dir" "$dir_id" "$prefix"

    # 8. Validate project structure
    validate_project_structure "$test_dir" "$dir_id" "$prefix"

    # 9. Verify the spec references pixel art / retro aesthetic
    if [[ -f "${directive_dir}/landing-page-spec.md" ]]; then
      local spec_content
      spec_content="$(cat "${directive_dir}/landing-page-spec.md")"
      assert_contains "$spec_content" "pixel art" "${prefix}: spec mentions pixel art"
      assert_contains "$spec_content" "retro" "${prefix}: spec mentions retro aesthetic"
      assert_contains "$spec_content" "self-contained HTML" "${prefix}: spec requires self-contained HTML"
    fi

    local t_elapsed
    t_elapsed="$(timing_stop "$t_start")"

    local run_passes=$(( _PASS_COUNT - run_pass_before ))
    local run_fails=$(( _FAIL_COUNT - run_fail_before ))
    record_benchmark_result "landing-page" "$config" "$dir_id" "$run_passes" "$run_fails" "$t_elapsed"
    timing_record "${prefix}" "$t_elapsed" "$(if (( run_fails == 0 )); then echo ok; else echo fail; fi)"

    # Copy artifacts
    copy_artifacts "$test_dir" "$BENCHMARK_RESULTS_DIR" "$label"
  done

  # Write landing-page results JSON
  write_benchmark_json "landing-page" "${BENCHMARK_RESULTS_DIR}/benchmark-landing-page.json"
  log_info "Landing page results written to ${BENCHMARK_RESULTS_DIR}/benchmark-landing-page.json"
}

# ─── Improve Benchmark Runner ───────────────────────────────────────────────

run_improve_benchmark() {
  log_section "Benchmark Type: Improve and Polish (spec + directive structure x configs)"

  local spec_file="${SCRIPT_DIR}/specs/improve-spec.md"
  assert_file_not_empty "$spec_file" "improve: spec file exists"

  for config in $CONFIGS; do
    local label="improve-${config}"
    local prefix="improve/${config}"

    log_info "Running: ${prefix}"

    local run_pass_before=$_PASS_COUNT
    local run_fail_before=$_FAIL_COUNT

    local t_start
    t_start="$(timing_start)"

    # 1. Reset fixture
    local test_dir
    test_dir="$(reset_fixture "${label}")"
    add_bench_temp_dir "$test_dir"

    # 2. Scaffold config
    scaffold_config "$test_dir" "$config"

    # 3. Verify agent count
    verify_agent_count "$test_dir" "$config"

    # 4. Create improve directive that references the original landing page
    local dir_id="improve-landing-page"
    create_directive "$test_dir" "$dir_id" \
      "Improve and Polish Landing Page" \
      "Take the existing landing page (index.html) and improve it with responsive breakpoints, accessibility, micro-animations, and typography polish. MUST preserve all 6 original sections: Hero, Features Grid, How It Works, Agent Showcase, Pricing, Footer CTA."

    # 5. Copy spec into the directive directory
    local directive_dir="${test_dir}/.context/directives/${dir_id}"
    cp "$spec_file" "${directive_dir}/improve-spec.md"
    assert_file_not_empty "${directive_dir}/improve-spec.md" "${prefix}: spec copied into directive"

    # 6. Create project under the directive
    local project_path="${directive_dir}/projects/${dir_id}"
    mkdir -p "$project_path"

    cat > "${project_path}/project.json" <<ENDJSON
{
  "id": "${dir_id}",
  "title": "Improve and Polish Landing Page",
  "status": "pending",
  "agent": ["frontend"],
  "reviewers": ["qa", "cpo"],
  "tasks": [
    {
      "id": "responsive",
      "title": "Add responsive breakpoints for mobile/tablet/desktop",
      "status": "pending",
      "agent": ["frontend"],
      "dod": [
        { "criterion": "Mobile breakpoint (max-width: 480px) with single column", "met": false },
        { "criterion": "Tablet breakpoint (481-768px) with 2-column grids", "met": false },
        { "criterion": "Desktop breakpoint (1025px+) with max-width container", "met": false },
        { "criterion": "No horizontal overflow at any breakpoint", "met": false }
      ]
    },
    {
      "id": "accessibility",
      "title": "Add WCAG 2.1 AA accessibility improvements",
      "status": "pending",
      "agent": ["frontend"],
      "dod": [
        { "criterion": "aria-label on all interactive elements", "met": false },
        { "criterion": "Keyboard navigation with visible focus indicators", "met": false },
        { "criterion": "Color contrast meets 4.5:1 ratio", "met": false },
        { "criterion": "Skip-to-content link at top of page", "met": false },
        { "criterion": "Correct heading hierarchy (h1 > h2 > h3)", "met": false }
      ]
    },
    {
      "id": "animations",
      "title": "Add micro-animations and polish",
      "status": "pending",
      "agent": ["frontend"],
      "dod": [
        { "criterion": "Hover effects on interactive elements", "met": false },
        { "criterion": "Scroll reveal animations on sections", "met": false },
        { "criterion": "prefers-reduced-motion media query respected", "met": false },
        { "criterion": "Consistent spacing using base unit", "met": false }
      ]
    },
    {
      "id": "regression",
      "title": "Verify all original sections preserved",
      "status": "pending",
      "agent": ["qa"],
      "dod": [
        { "criterion": "Hero section present with pixel art and CTA", "met": false },
        { "criterion": "Features Grid with all 6 features", "met": false },
        { "criterion": "How It Works with 3 steps", "met": false },
        { "criterion": "Agent Showcase with all roles", "met": false },
        { "criterion": "Pricing with 3 tiers", "met": false },
        { "criterion": "Footer CTA with links", "met": false }
      ]
    }
  ]
}
ENDJSON

    # 7. Validate directive structure
    validate_directive_structure "$test_dir" "$dir_id" "$prefix"

    # 8. Validate project structure
    validate_project_structure "$test_dir" "$dir_id" "$prefix"

    # 9. Regression check: directive scope mentions preserving original sections
    local djson="${test_dir}/.context/directives/${dir_id}/directive.json"
    if [[ -f "$djson" ]]; then
      local scope_text
      scope_text="$(jq -r '.scope.description' "$djson" 2>/dev/null)" || scope_text=""
      assert_contains "$scope_text" "preserve all 6 original sections" \
        "${prefix}: directive scope mentions preserving original sections"
    fi

    # 10. Verify the spec has accessibility and responsive requirements
    if [[ -f "${directive_dir}/improve-spec.md" ]]; then
      local spec_content
      spec_content="$(cat "${directive_dir}/improve-spec.md")"
      assert_contains "$spec_content" "Responsive Breakpoints" "${prefix}: spec has responsive requirements"
      assert_contains "$spec_content" "Accessibility" "${prefix}: spec has accessibility requirements"
      assert_contains "$spec_content" "prefers-reduced-motion" "${prefix}: spec respects reduced motion"
      assert_contains "$spec_content" "Preserve Original Sections" "${prefix}: spec has regression constraint"
    fi

    local t_elapsed
    t_elapsed="$(timing_stop "$t_start")"

    local run_passes=$(( _PASS_COUNT - run_pass_before ))
    local run_fails=$(( _FAIL_COUNT - run_fail_before ))
    record_benchmark_result "improve" "$config" "$dir_id" "$run_passes" "$run_fails" "$t_elapsed"
    timing_record "${prefix}" "$t_elapsed" "$(if (( run_fails == 0 )); then echo ok; else echo fail; fi)"

    # Copy artifacts
    copy_artifacts "$test_dir" "$BENCHMARK_RESULTS_DIR" "$label"
  done

  # Write improve results JSON
  write_benchmark_json "improve" "${BENCHMARK_RESULTS_DIR}/benchmark-improve.json"
  log_info "Improve results written to ${BENCHMARK_RESULTS_DIR}/benchmark-improve.json"
}

# ─── Route to benchmark types ───────────────────────────────────────────────

printf "\n${C_BOLD}Agent Benchmark Suite${C_RESET}\n"
printf "${C_DIM}Type: %s | Config: %s${C_RESET}\n" "$BENCH_TYPE" "$BENCH_CONFIG"

if [[ "$BENCH_TYPE" == "all" || "$BENCH_TYPE" == "bugfix" ]]; then
  run_bugfix_benchmark
fi

if [[ "$BENCH_TYPE" == "all" || "$BENCH_TYPE" == "landing-page" ]]; then
  run_landing_page_benchmark
fi

if [[ "$BENCH_TYPE" == "all" || "$BENCH_TYPE" == "improve" ]]; then
  run_improve_benchmark
fi

# ─── Combined summary ───────────────────────────────────────────────────────

write_combined_summary "$BENCHMARK_RESULTS_DIR"

# ─── Timing report ──────────────────────────────────────────────────────────

log_section "Benchmark Timing Report"
timing_report

# ─── Write dimension result ─────────────────────────────────────────────────

DIM_ELAPSED="$(stop_timer "$DIM_START")"
write_result_json "$DIM_NAME" "$DIM_ELAPSED"

log_section "dim-agent-benchmark results"
printf "  Pass: %d  Fail: %d  Time: %d ms\n\n" "$_PASS_COUNT" "$_FAIL_COUNT" "$DIM_ELAPSED"

# Exit with failure if any tests failed
if (( _FAIL_COUNT > 0 )); then
  exit 1
fi
