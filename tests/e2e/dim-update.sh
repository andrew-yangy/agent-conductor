#!/usr/bin/env bash
set -euo pipefail

# ─── Dimension: gruai update Command ─────────────────────────────────────────
#
# Tests the update command end-to-end:
#   1. Init a project
#   2. Modify user data (.context/, agents/, config)
#   3. Run update
#   4. Verify: backup created, skills updated, user data preserved
#   5. Verify: CLAUDE.md re-rendered with agent roster
#   6. Error: update on non-gruai dir
#   7. update --help
#
# Compatible with bash 3.2+ (macOS default).
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/utils.sh"

DIM_NAME="update"
DIM_START="$(start_timer)"

TEST_DIR=""

cleanup() {
  if [[ -n "$TEST_DIR" ]]; then
    cleanup_test_dir "$TEST_DIR"
  fi
}
trap cleanup EXIT

# ─── Helper ──────────────────────────────────────────────────────────────────

# run_gruai_update <project_dir>
run_gruai_update() {
  local project_dir="$1"
  (
    cd "$project_dir" || exit 1
    node "$GRUAI_CLI" update 2>&1
  )
}

# ─── Setup ───────────────────────────────────────────────────────────────────

log_section "Setup: init project for update tests"

TEST_DIR="$(create_test_dir "e2e-test-update")"
log_info "Test dir: ${TEST_DIR}"

# Init with standard preset (has more agents to verify roster)
init_output="$(run_gruai_init "$TEST_DIR" "standard" 2>&1)" || true
assert_dir_exists "${TEST_DIR}/.gruai" "project initialized"

# ─── Pre-update: verify baseline ─────────────────────────────────────────────

log_section "Test: pre-update baseline"

assert_file_exists "${TEST_DIR}/CLAUDE.md" "CLAUDE.md exists before update"
assert_file_exists "${TEST_DIR}/gruai.config.json" "gruai.config.json exists before update"

# Check that skills were scaffolded
SKILLS_DIR="${TEST_DIR}/.gruai/skills"
if [[ -d "$SKILLS_DIR" ]]; then
  skill_count="$(ls -d "${SKILLS_DIR}"/*/ 2>/dev/null | wc -l | tr -d ' ')"
  if (( skill_count > 0 )); then
    log_pass "skills directory has $skill_count skills"
  else
    log_fail "skills directory has skills" "empty"
  fi
else
  log_fail "skills directory exists" "not found at ${SKILLS_DIR}"
fi

# Record CLAUDE.md content for later comparison
CLAUDE_MD_BEFORE="$(cat "${TEST_DIR}/CLAUDE.md" 2>/dev/null || echo "")"

# ─── Add user data that must survive update ──────────────────────────────────

log_section "Test: create user data to preserve"

# Create user directive
mkdir -p "${TEST_DIR}/.context/directives/my-feature"
cat > "${TEST_DIR}/.context/directives/my-feature/directive.json" <<'JSON'
{
  "id": "my-feature",
  "title": "My Important Feature",
  "weight": "medium",
  "status": "in_progress"
}
JSON
assert_file_exists "${TEST_DIR}/.context/directives/my-feature/directive.json" "user directive created"

# Create a user lesson
mkdir -p "${TEST_DIR}/.context/lessons"
echo "# My Lesson" > "${TEST_DIR}/.context/lessons/my-lesson.md"
assert_file_exists "${TEST_DIR}/.context/lessons/my-lesson.md" "user lesson created"

# Modify gruai.config.json (add a custom field)
if command -v jq &>/dev/null; then
  jq '. + {"custom_field": "user_value"}' "${TEST_DIR}/gruai.config.json" > "${TEST_DIR}/gruai.config.json.tmp"
  mv "${TEST_DIR}/gruai.config.json.tmp" "${TEST_DIR}/gruai.config.json"
  log_pass "gruai.config.json: added custom_field"
fi

# ─── Run update ──────────────────────────────────────────────────────────────

log_section "Test: run gruai update"

update_output="$(run_gruai_update "$TEST_DIR" 2>&1)"
update_exit=$?

if [[ $update_exit -eq 0 ]]; then
  log_pass "update: exits 0 (success)"
else
  log_fail "update: exits 0" "exited $update_exit"
fi

assert_contains "$update_output" "updated" "update: output mentions 'updated'"
assert_contains "$update_output" "backed up" "update: output mentions 'backed up'"

# ─── Verify backup created ──────────────────────────────────────────────────

log_section "Test: backup directory"

BACKUP_BASE="${TEST_DIR}/.gruai-backup"
if [[ -d "$BACKUP_BASE" ]]; then
  log_pass "backup directory exists"

  # Should have exactly one timestamped subdirectory
  backup_count="$(ls -d "${BACKUP_BASE}"/*/ 2>/dev/null | wc -l | tr -d ' ')"
  if (( backup_count >= 1 )); then
    log_pass "backup has $backup_count timestamped dir(s)"
  else
    log_fail "backup has timestamped dirs" "found $backup_count"
  fi

  # Backup should contain CLAUDE.md
  backup_dir="$(ls -d "${BACKUP_BASE}"/*/ 2>/dev/null | head -1)"
  if [[ -n "$backup_dir" ]]; then
    if [[ -f "${backup_dir}CLAUDE.md" ]]; then
      log_pass "backup contains CLAUDE.md"
    else
      log_fail "backup contains CLAUDE.md" "not found in $backup_dir"
    fi
  fi
else
  log_fail "backup directory exists" "not found at ${BACKUP_BASE}"
fi

# ─── Verify user data preserved ─────────────────────────────────────────────

log_section "Test: user data preserved after update"

# .context directives
assert_file_exists "${TEST_DIR}/.context/directives/my-feature/directive.json" \
  "preserve: user directive.json"
if [[ -f "${TEST_DIR}/.context/directives/my-feature/directive.json" ]]; then
  assert_json_field "${TEST_DIR}/.context/directives/my-feature/directive.json" \
    '.id' "my-feature" "preserve: directive id intact"
fi

# .context lessons
assert_file_exists "${TEST_DIR}/.context/lessons/my-lesson.md" "preserve: user lesson"

# gruai.config.json
assert_file_exists "${TEST_DIR}/gruai.config.json" "preserve: gruai.config.json"
if command -v jq &>/dev/null; then
  custom_val="$(jq -r '.custom_field // empty' "${TEST_DIR}/gruai.config.json" 2>/dev/null)"
  if [[ "$custom_val" == "user_value" ]]; then
    log_pass "preserve: gruai.config.json custom_field intact"
  else
    log_fail "preserve: gruai.config.json custom_field" "got: $custom_val"
  fi
fi

# agent-registry.json
assert_file_exists "${TEST_DIR}/.gruai/agent-registry.json" "preserve: agent-registry.json"

# ─── Verify skills updated ──────────────────────────────────────────────────

log_section "Test: skills updated"

# Skills dir should still exist with at least the directive skill
assert_dir_exists "${SKILLS_DIR}" "skills dir exists after update"

for skill in directive scout healthcheck report; do
  skill_file="${SKILLS_DIR}/${skill}/SKILL.md"
  if [[ -f "$skill_file" ]]; then
    log_pass "skill updated: ${skill}/SKILL.md exists"
  else
    # Not all presets have all skills, so just info
    log_info "skill not found: ${skill}/SKILL.md (may not be in preset)"
  fi
done

# ─── Verify CLAUDE.md re-rendered ────────────────────────────────────────────

log_section "Test: CLAUDE.md re-rendered"

assert_file_exists "${TEST_DIR}/CLAUDE.md" "CLAUDE.md exists after update"
assert_file_not_empty "${TEST_DIR}/CLAUDE.md" "CLAUDE.md is non-empty"

CLAUDE_MD_AFTER="$(cat "${TEST_DIR}/CLAUDE.md" 2>/dev/null || echo "")"
if [[ "$CLAUDE_MD_AFTER" != "$CLAUDE_MD_BEFORE" ]]; then
  log_pass "CLAUDE.md: content changed (re-rendered)"
else
  log_info "CLAUDE.md: content unchanged (template may be identical)"
fi

# Should contain agent roster
if echo "$CLAUDE_MD_AFTER" | grep -qi "CEO"; then
  log_pass "CLAUDE.md: contains CEO in roster"
else
  log_fail "CLAUDE.md: contains CEO" "not found"
fi

# ─── Test: update on non-gruai directory ────────────────────────────────────

log_section "Test: update on non-gruai dir (should fail)"

EMPTY_DIR="$(create_test_dir "e2e-test-update-empty")"
update_noproject_exit=0
update_noproject_output="$(cd "$EMPTY_DIR" && node "$GRUAI_CLI" update 2>&1)" || update_noproject_exit=$?

if [[ $update_noproject_exit -ne 0 ]]; then
  log_pass "update non-gruai dir: exits non-zero (code $update_noproject_exit)"
else
  log_fail "update non-gruai dir: exits non-zero" "exited 0"
fi

assert_contains "$update_noproject_output" "not appear to be" \
  "update non-gruai dir: error message"

# Clean up empty dir
rm -rf "$EMPTY_DIR"

# ─── Test: update --help ────────────────────────────────────────────────────

log_section "Test: update --help"

update_help="$(node "$GRUAI_CLI" update --help 2>&1)" || true
assert_contains "$update_help" "update" "update --help: contains 'update'"
assert_contains "$update_help" "backup" "update --help: mentions backup strategy"

# ─── Test: second update (idempotent) ───────────────────────────────────────

log_section "Test: second update (idempotent)"

update2_output="$(run_gruai_update "$TEST_DIR" 2>&1)"
update2_exit=$?

if [[ $update2_exit -eq 0 ]]; then
  log_pass "second update: exits 0"
else
  log_fail "second update: exits 0" "exited $update2_exit"
fi

# Should now have 2 backup dirs
backup_count2="$(ls -d "${BACKUP_BASE}"/*/ 2>/dev/null | wc -l | tr -d ' ')"
if (( backup_count2 >= 2 )); then
  log_pass "second update: created additional backup ($backup_count2 total)"
else
  log_info "second update: $backup_count2 backup dir(s) — timestamps may have collided"
fi

# User data still preserved after second update
assert_file_exists "${TEST_DIR}/.context/directives/my-feature/directive.json" \
  "second update: user data still preserved"

# ─── Write results ───────────────────────────────────────────────────────────

DIM_ELAPSED="$(stop_timer "$DIM_START")"
write_result_json "$DIM_NAME" "$DIM_ELAPSED"

log_section "dim-update results"
printf "  Pass: %d  Fail: %d  Time: %d ms\n\n" "$_PASS_COUNT" "$_FAIL_COUNT" "$DIM_ELAPSED"

if (( _FAIL_COUNT > 0 )); then
  exit 1
fi
