#!/usr/bin/env bash
set -euo pipefail

# ─── Dimension: Fresh Install & Init (3 Presets) ─────────────────────────────
#
# Tests gru-ai init for starter, standard, and full presets.
# Verifies file structure, agent counts, registry, symlinks, context tree.
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/utils.sh"

DIM_NAME="init"
DIM_START="$(start_timer)"

# Track temp dirs for cleanup
TEMP_DIR_COUNT=0
cleanup() {
  local i=0
  while (( i < TEMP_DIR_COUNT )); do
    eval "cleanup_test_dir \"\$TEMP_DIR_${i}\""
    i=$(( i + 1 ))
  done
}
trap cleanup EXIT

add_temp_dir() {
  eval "TEMP_DIR_${TEMP_DIR_COUNT}=\"$1\""
  TEMP_DIR_COUNT=$(( TEMP_DIR_COUNT + 1 ))
}

# ─── Expected agent counts (agents + CEO in registry) ────────────────────────
# starter:  4 agents + CEO = 5 entries
# standard: 7 agents + CEO = 8 entries
# full:     11 agents + CEO = 12 entries

get_expected_count() {
  case "$1" in
    starter)  echo 5 ;;
    standard) echo 8 ;;
    full)     echo 12 ;;
  esac
}

# ─── Test each preset ────────────────────────────────────────────────────────

test_preset() {
  local preset="$1"
  local expected_count
  expected_count="$(get_expected_count "$preset")"

  log_section "Preset: ${preset} (expect ${expected_count} agents in registry)"

  local test_dir
  test_dir="$(create_test_dir "e2e-test-init-${preset}")"
  add_temp_dir "$test_dir"

  log_info "Test dir: ${test_dir}"

  # Run init
  log_info "Running: npx gru-ai init --name test-project --preset ${preset} --yes"
  local init_output
  init_output="$(run_gruai_init "$test_dir" "$preset" 2>&1)" || true

  # 1. Verify .gruai/ directory exists
  assert_dir_exists "${test_dir}/.gruai" "${preset}: .gruai/ directory exists"

  # 2. Verify platform symlink (.claude/ -> .gruai/)
  assert_symlink "${test_dir}/.claude" ".gruai" "${preset}: .claude/ symlink -> .gruai/"

  # 3. Verify gruai.config.json exists and has correct fields
  local config_file="${test_dir}/gruai.config.json"
  assert_file_exists "$config_file" "${preset}: gruai.config.json exists"

  if [[ -f "$config_file" ]]; then
    assert_json_valid "$config_file" "${preset}: gruai.config.json is valid JSON"
    assert_json_field "$config_file" '.name' "test-project" "${preset}: config.name = test-project"
    assert_json_field "$config_file" '.preset' "$preset" "${preset}: config.preset = ${preset}"
    assert_json_field "$config_file" '.platform' "claude-code" "${preset}: config.platform = claude-code"
  fi

  # 4. Verify agent-registry.json exists and has correct agent count
  local registry_file="${test_dir}/.gruai/agent-registry.json"
  assert_file_exists "$registry_file" "${preset}: agent-registry.json exists"

  if [[ -f "$registry_file" ]] && command -v jq &>/dev/null; then
    assert_json_valid "$registry_file" "${preset}: agent-registry.json is valid JSON"

    local actual_count
    actual_count="$(jq '.agents | length' "$registry_file")"
    assert_eq "$actual_count" "$expected_count" "${preset}: agent count = ${expected_count}"

    # Verify CEO entry exists
    local ceo_id
    ceo_id="$(jq -r '.agents[0].id' "$registry_file")"
    assert_eq "$ceo_id" "ceo" "${preset}: first agent is CEO"

    # Verify teamSize field
    assert_json_field "$registry_file" '.teamSize' "$preset" "${preset}: registry.teamSize = ${preset}"
  fi

  # 5. Verify every agentFile referenced in registry exists as a non-empty file
  if [[ -f "$registry_file" ]] && command -v jq &>/dev/null; then
    local agent_files
    agent_files="$(jq -r '.agents[] | select(.agentFile != null) | .agentFile' "$registry_file")"
    local all_exist=true

    while IFS= read -r agent_file; do
      if [[ -z "$agent_file" ]]; then continue; fi
      local full_path="${test_dir}/.gruai/agents/${agent_file}"
      if [[ ! -s "$full_path" ]]; then
        log_fail "${preset}: agent file exists and non-empty: ${agent_file}" "not found or empty: ${full_path}"
        all_exist=false
      fi
    done <<< "$agent_files"

    if $all_exist; then
      log_pass "${preset}: all agentFile entries exist as non-empty files"
    fi
  fi

  # 6. Verify .context/ directory structure
  assert_dir_exists "${test_dir}/.context" "${preset}: .context/ directory exists"
  assert_file_exists "${test_dir}/.context/vision.md" "${preset}: .context/vision.md exists"
  assert_dir_exists "${test_dir}/.context/directives" "${preset}: .context/directives/ exists"
  assert_dir_exists "${test_dir}/.context/lessons" "${preset}: .context/lessons/ exists"

  # 7. Verify CLAUDE.md was created
  assert_file_not_empty "${test_dir}/CLAUDE.md" "${preset}: CLAUDE.md exists and non-empty"

  # 8. Verify welcome directive was scaffolded
  assert_file_exists "${test_dir}/.context/directives/welcome/directive.json" \
    "${preset}: welcome directive.json exists"

  log_info "Preset ${preset} done."
}

# ─── Run all presets ─────────────────────────────────────────────────────────

for preset in starter standard full; do
  test_preset "$preset"
done

# ─── Write results ───────────────────────────────────────────────────────────

DIM_ELAPSED="$(stop_timer "$DIM_START")"
write_result_json "$DIM_NAME" "$DIM_ELAPSED"

log_section "dim-init results"
printf "  Pass: %d  Fail: %d  Time: %d ms\n\n" "$_PASS_COUNT" "$_FAIL_COUNT" "$DIM_ELAPSED"

# Exit with failure if any tests failed
if (( _FAIL_COUNT > 0 )); then
  exit 1
fi
