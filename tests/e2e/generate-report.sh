#!/usr/bin/env bash
set -euo pipefail

# ─── Benchmark Report Generator ─────────────────────────────────────────────
#
# Reads agent benchmark results from tests/e2e/results/agent-benchmark/
# and produces BENCHMARK-REPORT.md with tables for each benchmark type.
#
# Usage:
#   ./generate-report.sh                    # Output to tests/e2e/BENCHMARK-REPORT.md
#   ./generate-report.sh --output /path     # Custom output path
#
# Compatible with bash 3.2+ (macOS default).
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results/agent-benchmark"
OUTPUT_FILE="${SCRIPT_DIR}/BENCHMARK-REPORT.md"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: ./generate-report.sh [--output FILE]"
      echo "Reads results from tests/e2e/results/agent-benchmark/ and generates a markdown report."
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Check jq is available
if ! command -v jq &>/dev/null; then
  echo "Error: jq is required to generate the report"
  exit 1
fi

# Check results exist
if [[ ! -d "$RESULTS_DIR" ]]; then
  echo "Error: Results directory not found at $RESULTS_DIR"
  echo "Run dim-agent-benchmark.sh first."
  exit 1
fi

# ─── Helper functions ────────────────────────────────────────────────────────

# Get version from package.json if available
get_version() {
  local pkg="${SCRIPT_DIR}/../../package.json"
  if [[ -f "$pkg" ]] && command -v jq &>/dev/null; then
    jq -r '.version // "unknown"' "$pkg" 2>/dev/null || echo "unknown"
  else
    echo "unknown"
  fi
}

# Format duration: ms -> human readable
format_duration() {
  local ms="$1"
  if (( ms < 1000 )); then
    echo "${ms}ms"
  else
    local secs=$(( ms / 1000 ))
    local remainder=$(( ms % 1000 ))
    echo "${secs}.${remainder}s"
  fi
}

# ─── Report section generators ──────────────────────────────────────────────

emit_bugfix_section() {
  local bugfix_file="${RESULTS_DIR}/benchmark-bugfix.json"
  if [[ -f "$bugfix_file" ]]; then
    echo "## Bug-Fix Benchmark"
    echo ""
    echo "5 test directives tested across 3 configuration presets."
    echo ""
    echo "| Directive | Config | Pass | Fail | Status | Time |"
    echo "|-----------|--------|------|------|--------|------|"

    local result_count
    result_count="$(jq '.results | length' "$bugfix_file")"
    local i=0
    while (( i < result_count )); do
      local config dir_id passes fails status dur status_icon
      config="$(jq -r ".results[$i].config" "$bugfix_file")"
      dir_id="$(jq -r ".results[$i].directive" "$bugfix_file")"
      passes="$(jq -r ".results[$i].pass_count" "$bugfix_file")"
      fails="$(jq -r ".results[$i].fail_count" "$bugfix_file")"
      status="$(jq -r ".results[$i].status" "$bugfix_file")"
      dur="$(jq -r ".results[$i].duration_ms" "$bugfix_file")"

      if [[ "$status" == "pass" ]]; then
        status_icon="PASS"
      else
        status_icon="FAIL"
      fi

      echo "| ${dir_id} | ${config} | ${passes} | ${fails} | ${status_icon} | $(format_duration "$dur") |"
      i=$(( i + 1 ))
    done

    echo ""

    local total_passes total_fails
    total_passes="$(jq '[.results[].pass_count] | add // 0' "$bugfix_file")"
    total_fails="$(jq '[.results[].fail_count] | add // 0' "$bugfix_file")"
    echo "**Bug-Fix Total:** ${total_passes} pass, ${total_fails} fail out of ${result_count} runs"
  else
    echo "## Bug-Fix Benchmark"
    echo ""
    echo "_No bug-fix benchmark results found._"
  fi
  echo ""
  echo "---"
  echo ""
}

emit_landing_page_section() {
  local lp_file="${RESULTS_DIR}/benchmark-landing-page.json"
  if [[ -f "$lp_file" ]]; then
    echo "## Landing Page Benchmark"
    echo ""
    echo "Directive structure validation for landing page build across configs."
    echo ""
    echo "| Config | Pass | Fail | Status | Time |"
    echo "|--------|------|------|--------|------|"

    local result_count
    result_count="$(jq '.results | length' "$lp_file")"
    local i=0
    while (( i < result_count )); do
      local config passes fails status dur status_icon
      config="$(jq -r ".results[$i].config" "$lp_file")"
      passes="$(jq -r ".results[$i].pass_count" "$lp_file")"
      fails="$(jq -r ".results[$i].fail_count" "$lp_file")"
      status="$(jq -r ".results[$i].status" "$lp_file")"
      dur="$(jq -r ".results[$i].duration_ms" "$lp_file")"

      if [[ "$status" == "pass" ]]; then
        status_icon="PASS"
      else
        status_icon="FAIL"
      fi

      echo "| ${config} | ${passes} | ${fails} | ${status_icon} | $(format_duration "$dur") |"
      i=$(( i + 1 ))
    done

    echo ""

    local total_passes total_fails
    total_passes="$(jq '[.results[].pass_count] | add // 0' "$lp_file")"
    total_fails="$(jq '[.results[].fail_count] | add // 0' "$lp_file")"
    echo "**Landing Page Total:** ${total_passes} pass, ${total_fails} fail out of ${result_count} runs"
  else
    echo "## Landing Page Benchmark"
    echo ""
    echo "_No landing page benchmark results found._"
  fi
  echo ""
  echo "---"
  echo ""
}

emit_improve_section() {
  local imp_file="${RESULTS_DIR}/benchmark-improve.json"
  if [[ -f "$imp_file" ]]; then
    echo "## Improve and Polish Benchmark"
    echo ""
    echo "Directive structure validation for improve-and-polish workflow across configs."
    echo ""
    echo "| Config | Pass | Fail | Status | Time |"
    echo "|--------|------|------|--------|------|"

    local result_count
    result_count="$(jq '.results | length' "$imp_file")"
    local i=0
    while (( i < result_count )); do
      local config passes fails status dur status_icon
      config="$(jq -r ".results[$i].config" "$imp_file")"
      passes="$(jq -r ".results[$i].pass_count" "$imp_file")"
      fails="$(jq -r ".results[$i].fail_count" "$imp_file")"
      status="$(jq -r ".results[$i].status" "$imp_file")"
      dur="$(jq -r ".results[$i].duration_ms" "$imp_file")"

      if [[ "$status" == "pass" ]]; then
        status_icon="PASS"
      else
        status_icon="FAIL"
      fi

      echo "| ${config} | ${passes} | ${fails} | ${status_icon} | $(format_duration "$dur") |"
      i=$(( i + 1 ))
    done

    echo ""

    local total_passes total_fails
    total_passes="$(jq '[.results[].pass_count] | add // 0' "$imp_file")"
    total_fails="$(jq '[.results[].fail_count] | add // 0' "$imp_file")"
    echo "**Improve Total:** ${total_passes} pass, ${total_fails} fail out of ${result_count} runs"
  else
    echo "## Improve and Polish Benchmark"
    echo ""
    echo "_No improve benchmark results found._"
  fi
  echo ""
  echo "---"
  echo ""
}

emit_summary_section() {
  local summary_file="${RESULTS_DIR}/summary.json"
  if [[ -f "$summary_file" ]]; then
    echo "## Overall Summary"
    echo ""

    local total_runs total_pass total_fail overall_status
    total_runs="$(jq -r '.total_runs' "$summary_file")"
    total_pass="$(jq -r '.total_pass' "$summary_file")"
    total_fail="$(jq -r '.total_fail' "$summary_file")"
    overall_status="$(jq -r '.status' "$summary_file")"

    echo "| Metric | Value |"
    echo "|--------|-------|"
    echo "| Total Runs | ${total_runs} |"
    echo "| Total Pass | ${total_pass} |"
    echo "| Total Fail | ${total_fail} |"
    echo "| Status | ${overall_status} |"
    echo ""
    echo "---"
    echo ""
  fi
}

emit_manifest_section() {
  echo "## File Manifest"
  echo ""
  echo "Inspectable artifacts produced by this benchmark run:"
  echo ""
  echo "| File | Description |"
  echo "|------|-------------|"

  if [[ -d "$RESULTS_DIR" ]]; then
    # JSON result files
    local f
    for f in "${RESULTS_DIR}"/*.json; do
      if [[ -f "$f" ]]; then
        local bname desc
        bname="$(basename "$f")"
        case "$bname" in
          summary.json) desc="Combined benchmark summary" ;;
          benchmark-bugfix.json) desc="Bug-fix benchmark detailed results" ;;
          benchmark-landing-page.json) desc="Landing page benchmark detailed results" ;;
          benchmark-improve.json) desc="Improve benchmark detailed results" ;;
          *) desc="Benchmark result data" ;;
        esac
        echo "| \`results/agent-benchmark/${bname}\` | ${desc} |"
      fi
    done

    # Artifact directories
    if [[ -d "${RESULTS_DIR}/artifacts" ]]; then
      local artifact_dir
      for artifact_dir in "${RESULTS_DIR}/artifacts"/*/; do
        if [[ -d "$artifact_dir" ]]; then
          local dname
          dname="$(basename "$artifact_dir")"
          echo "| \`results/agent-benchmark/artifacts/${dname}/\` | Directive structure for ${dname} |"
        fi
      done
    fi
  fi

  # Spec files
  echo "| \`specs/landing-page-spec.md\` | Landing page requirements spec |"
  echo "| \`specs/improve-spec.md\` | Improve and polish requirements spec |"

  echo ""
  echo "---"
  echo ""
}

# ─── Build report ───────────────────────────────────────────────────────────

generate_report() {
  local version report_date local_date
  version="$(get_version)"
  report_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local_date="$(date +%Y-%m-%d)"

  cat <<HEADER
# Agent Benchmark Report

| Field | Value |
|-------|-------|
| Date | ${local_date} |
| Generated | ${report_date} |
| gru-ai Version | ${version} |
| Configs Tested | starter, standard, full |

---

HEADER

  emit_bugfix_section
  emit_landing_page_section
  emit_improve_section
  emit_summary_section
  emit_manifest_section

  echo "_Generated by \`generate-report.sh\` on ${report_date}_"
}

generate_report > "$OUTPUT_FILE"

echo "Report written to: ${OUTPUT_FILE}"
echo "$(wc -l < "$OUTPUT_FILE" | tr -d ' ') lines"
