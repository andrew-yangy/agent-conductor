#!/usr/bin/env bash
set -euo pipefail

# ─── Dimension: Multi-Platform Init ──────────────────────────────────────────
#
# Tests gru-ai init with all 5 platform variants:
#   claude-code -> .claude/ symlink
#   aider       -> .aider/ symlink
#   gemini-cli  -> .gemini/ symlink
#   codex       -> .codex/ symlink
#   other       -> .gruai/ only, no symlink
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/utils.sh"

DIM_NAME="multiplatform"
DIM_START="$(start_timer)"

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

# ─── Platform -> expected directory mapping ──────────────────────────────────

get_platform_dir() {
  case "$1" in
    claude-code) echo ".claude" ;;
    aider)       echo ".aider" ;;
    gemini-cli)  echo ".gemini" ;;
    codex)       echo ".codex" ;;
    other)       echo "" ;;
  esac
}

# ─── Test each platform ─────────────────────────────────────────────────────

test_platform() {
  local platform="$1"
  local expected_dir
  expected_dir="$(get_platform_dir "$platform")"

  log_section "Platform: ${platform}"

  local test_dir
  test_dir="$(create_test_dir "e2e-test-platform-${platform}")"
  add_temp_dir "$test_dir"

  log_info "Test dir: ${test_dir}"

  # Run init with platform flag
  log_info "Running: npx gru-ai init --name test-project --preset starter --platform ${platform} --yes"
  local init_output
  init_output="$(run_gruai_init_with_platform "$test_dir" "starter" "$platform" 2>&1)" || true

  # 1. .gruai/ must always exist
  assert_dir_exists "${test_dir}/.gruai" "${platform}: .gruai/ directory exists"

  # 2. Platform-specific dir behavior
  if [[ -n "$expected_dir" ]]; then
    # Should have a symlink: expected_dir -> .gruai
    assert_symlink "${test_dir}/${expected_dir}" ".gruai" \
      "${platform}: ${expected_dir}/ symlink -> .gruai/"

    # Symlink should be traversable (agent files accessible via symlink)
    if [[ -d "${test_dir}/${expected_dir}/agents" ]]; then
      log_pass "${platform}: agents/ accessible via ${expected_dir}/ symlink"
    else
      log_fail "${platform}: agents/ accessible via ${expected_dir}/ symlink" \
        "directory not accessible through symlink"
    fi
  else
    # "other" platform: NO symlink should exist for any platform dir
    local has_unexpected_symlink=false
    for plat_dir in .claude .aider .gemini .codex; do
      if [[ -L "${test_dir}/${plat_dir}" ]]; then
        log_fail "${platform}: no unexpected ${plat_dir}/ symlink" \
          "found unexpected symlink ${plat_dir}"
        has_unexpected_symlink=true
      fi
    done
    if ! $has_unexpected_symlink; then
      log_pass "${platform}: no platform symlinks created (correct for 'other')"
    fi
  fi

  # 3. Config should reflect the platform
  local config_file="${test_dir}/gruai.config.json"
  if [[ -f "$config_file" ]]; then
    assert_json_field "$config_file" '.platform' "$platform" \
      "${platform}: config.platform = ${platform}"
  else
    log_fail "${platform}: gruai.config.json exists" "not found"
  fi

  # 4. Registry should still be created
  assert_file_exists "${test_dir}/.gruai/agent-registry.json" \
    "${platform}: agent-registry.json exists"

  # 5. Context tree should still be created
  assert_dir_exists "${test_dir}/.context" "${platform}: .context/ directory exists"

  log_info "Platform ${platform} done."
}

# ─── Run all platforms ───────────────────────────────────────────────────────

for platform in claude-code aider gemini-cli codex other; do
  test_platform "$platform"
done

# ─── Write results ───────────────────────────────────────────────────────────

DIM_ELAPSED="$(stop_timer "$DIM_START")"
write_result_json "$DIM_NAME" "$DIM_ELAPSED"

log_section "dim-multiplatform results"
printf "  Pass: %d  Fail: %d  Time: %d ms\n\n" "$_PASS_COUNT" "$_FAIL_COUNT" "$DIM_ELAPSED"

if (( _FAIL_COUNT > 0 )); then
  exit 1
fi
