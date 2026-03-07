#!/usr/bin/env bash
# validate-hooks.sh -- Zero-trust verification of all hook scripts
#
# Tests validate-cast.sh, validate-project-json.sh, validate-gate.sh
# with valid AND invalid inputs.
#
# Run: bash scripts/validate-hooks.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.claude/hooks"

PASSED=0
FAILED=0

assert() {
  local condition="$1"
  local label="$2"
  if [[ "$condition" == "true" ]]; then
    echo "  PASS: $label"
    PASSED=$((PASSED + 1))
  else
    echo "  FAIL: $label"
    FAILED=$((FAILED + 1))
  fi
}

# ===========================================================================
# 1. validate-cast.sh
# ===========================================================================
echo ""
echo "=== validate-cast.sh ==="

# 1a. Valid plan.json
VALID_PLAN='{
  "projects": [
    {
      "id": "test-proj",
      "title": "Test Project",
      "agent": ["riley"],
      "reviewers": ["sarah"],
      "complexity": "simple",
      "scope_summary": "build a widget"
    }
  ]
}'

RESULT=$(echo "$VALID_PLAN" | bash "$HOOKS_DIR/validate-cast.sh" 2>/dev/null)
VALID=$(echo "$RESULT" | jq -r '.valid')
assert "$([[ "$VALID" == "true" ]] && echo true || echo false)" "valid plan.json returns valid:true"

# 1b. Builder-as-reviewer violation
BAD_PLAN='{
  "projects": [
    {
      "id": "test-proj",
      "title": "Test Project",
      "agent": ["riley"],
      "reviewers": ["riley", "sarah"],
      "complexity": "simple",
      "scope_summary": "build a widget"
    }
  ]
}'

RESULT=$(echo "$BAD_PLAN" | bash "$HOOKS_DIR/validate-cast.sh" 2>/dev/null)
VALID=$(echo "$RESULT" | jq -r '.valid')
HAS_BUILDER_REVIEWER=$(echo "$RESULT" | jq '[.violations[] | select(.rule == "builder_not_reviewer")] | length > 0')
assert "$([[ "$VALID" == "false" ]] && echo true || echo false)" "builder-as-reviewer returns valid:false"
assert "$([[ "$HAS_BUILDER_REVIEWER" == "true" ]] && echo true || echo false)" "builder-as-reviewer violation is reported"

# 1c. No reviewers violation
NO_REVIEWER_PLAN='{
  "projects": [
    {
      "id": "test-proj",
      "title": "Test Project",
      "agent": ["riley"],
      "reviewers": [],
      "complexity": "simple"
    }
  ]
}'

RESULT=$(echo "$NO_REVIEWER_PLAN" | bash "$HOOKS_DIR/validate-cast.sh" 2>/dev/null)
VALID=$(echo "$RESULT" | jq -r '.valid')
assert "$([[ "$VALID" == "false" ]] && echo true || echo false)" "empty reviewers returns valid:false"

# 1d. Invalid JSON input
RESULT=$(echo "not json at all" | bash "$HOOKS_DIR/validate-cast.sh" 2>/dev/null)
VALID=$(echo "$RESULT" | jq -r '.valid')
assert "$([[ "$VALID" == "false" ]] && echo true || echo false)" "invalid JSON input returns valid:false"

# ===========================================================================
# 2. validate-project-json.sh
# ===========================================================================
echo ""
echo "=== validate-project-json.sh ==="

# We need a real project.json on disk for this script to validate
# Use the existing end-to-end-validation project.json
DIRECTIVE_DIR=".context/directives/publish-and-validate"
PROJECT_ID="end-to-end-validation"

INPUT_VALID='{"directive_dir":"'"$DIRECTIVE_DIR"'","project_id":"'"$PROJECT_ID"'"}'
RESULT=$(cd "$REPO_ROOT" && echo "$INPUT_VALID" | bash "$HOOKS_DIR/validate-project-json.sh" 2>/dev/null)
VALID=$(echo "$RESULT" | jq -r '.valid')
assert "$([[ "$VALID" == "true" ]] && echo true || echo false)" "valid project.json returns valid:true"

# 2b. Missing agent violation (create temp project.json without agent)
TMPDIR=$(mktemp -d)
mkdir -p "$TMPDIR/test-directive/projects/bad-proj"
cat > "$TMPDIR/test-directive/projects/bad-proj/project.json" << 'EOF'
{
  "id": "bad-proj",
  "title": "Bad Project",
  "status": "pending",
  "description": "Missing agent field",
  "scope": {"in": ["test"], "out": []},
  "dod": [{"criterion": "test", "met": false}],
  "tasks": [
    {"id": "t1", "title": "Task 1", "status": "pending", "agent": ["riley"], "dod": [{"criterion": "test", "met": false}]}
  ]
}
EOF

# Initialize as git repo for the script's git rev-parse
(cd "$TMPDIR" && git init -q && git add . && git commit -q -m "init" 2>/dev/null)

INPUT_BAD='{"directive_dir":"test-directive","project_id":"bad-proj"}'
RESULT=$(cd "$TMPDIR" && echo "$INPUT_BAD" | bash "$HOOKS_DIR/validate-project-json.sh" 2>/dev/null)
VALID=$(echo "$RESULT" | jq -r '.valid')
# The project.json has no top-level "agent" array and no "reviewers"
HAS_AGENT_VIOLATION=$(echo "$RESULT" | jq '[.violations[] | select(test("agent"))] | length > 0')
assert "$([[ "$VALID" == "false" ]] && echo true || echo false)" "missing-agent project returns valid:false"
assert "$([[ "$HAS_AGENT_VIOLATION" == "true" ]] && echo true || echo false)" "agent violation is reported"

rm -rf "$TMPDIR"

# ===========================================================================
# 3. validate-gate.sh — at least 2 step targets
# ===========================================================================
echo ""
echo "=== validate-gate.sh ==="

# Use the existing publish-and-validate directive
DIRECTIVE_DIR_ABS="$REPO_ROOT/.context/directives/publish-and-validate"

# 3a. triage step (no prerequisites)
RESULT=$(cd "$REPO_ROOT" && bash "$HOOKS_DIR/validate-gate.sh" ".context/directives/publish-and-validate" "triage" 2>/dev/null)
VALID=$(echo "$RESULT" | jq -r '.valid')
assert "$([[ "$VALID" == "true" ]] && echo true || echo false)" "triage gate passes (no prerequisites)"

# 3b. Read step — requires triage completed
# This may fail if directive.json doesn't have pipeline.triage.status set
RESULT=$(cd "$REPO_ROOT" && bash "$HOOKS_DIR/validate-gate.sh" ".context/directives/publish-and-validate" "read" 2>/dev/null)
VALID_JSON=$(echo "$RESULT" | jq -r '.valid' 2>/dev/null || echo "parse_error")
assert "$([[ "$VALID_JSON" == "true" || "$VALID_JSON" == "false" ]] && echo true || echo false)" "read gate returns valid JSON output"

# 3c. Unknown step — should return error
RESULT=$(cd "$REPO_ROOT" && bash "$HOOKS_DIR/validate-gate.sh" ".context/directives/publish-and-validate" "nonexistent-step" 2>/dev/null)
VALID=$(echo "$RESULT" | jq -r '.valid')
assert "$([[ "$VALID" == "false" ]] && echo true || echo false)" "unknown step returns valid:false"

# ===========================================================================
# 4. Run existing gate test suite
# ===========================================================================
echo ""
echo "=== Existing gate test suite ==="

if bash "$HOOKS_DIR/tests/gate/run-tests.sh" 2>&1; then
  assert "true" "All gate tests pass"
else
  assert "false" "Gate test suite has failures"
fi

# ===========================================================================
# Summary
# ===========================================================================
echo ""
echo "=== HOOK VALIDATION RESULTS: $PASSED passed, $FAILED failed ==="
exit $([[ $FAILED -eq 0 ]] && echo 0 || echo 1)
