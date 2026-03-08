#!/usr/bin/env bash
set -euo pipefail

# ─── Dimension: Full Integration (Init → Server → Game Data → Directives) ────
#
# THE real user story test: verifies the complete chain end-to-end.
# Every test creates a FRESH consumer project from scratch.
#
# Coverage matrix:
#   - ALL 5 platforms × ALL 3 presets for init→server→registry→game chain
#   - Directive/pipeline scenarios across multiple platforms
#   - Edge cases (corrupt JSON, empty project, live watcher)
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/utils.sh"

DIM_NAME="integration"
DIM_START="$(start_timer)"

# Track cleanup
TEMP_DIRS=""
SERVER_PIDS=""

cleanup() {
  for pid in $SERVER_PIDS; do
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  done
  for dir in $TEMP_DIRS; do
    if [[ -n "$dir" && -d "$dir" && "$dir" == *"e2e-test"* ]]; then
      rm -rf "$dir"
    fi
  done
}
trap cleanup EXIT

add_temp_dir() { TEMP_DIRS="$TEMP_DIRS $1"; }

# ─── Helper: start server and wait for ready ─────────────────────────────────

start_server() {
  local project_dir="$1"
  local port="$2"
  local log_file="/tmp/e2e-integ-${port}.log"

  GRUAI_PROJECT_PATH="$project_dir" PORT="$port" \
    npx tsx "${GRUAI_PACKAGE_ROOT}/server/index.ts" > "$log_file" 2>&1 &
  local pid=$!
  SERVER_PIDS="$SERVER_PIDS $pid"

  local waited=0
  while (( waited < 15 )); do
    if curl -sf "http://localhost:${port}/api/health" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
    waited=$(( waited + 1 ))
  done
  log_fail "server on port $port failed to start within 15s"
  tail -10 "$log_file" 2>/dev/null || true
  return 1
}

kill_server_on_port() {
  local port="$1"
  lsof -ti:"$port" 2>/dev/null | xargs kill 2>/dev/null || true
  sleep 1
}

# ─── Helper: query API with python3 ──────────────────────────────────────────

api_query() {
  local port="$1"
  local endpoint="$2"
  local py_expr="$3"
  curl -sf "http://localhost:${port}${endpoint}" 2>/dev/null | \
    python3 -c "import json,sys; data=json.load(sys.stdin); $py_expr" 2>/dev/null
}

# ─── Helper: create directive in consumer project ────────────────────────────

create_directive() {
  local project_dir="$1"
  local dir_id="$2"
  local title="$3"
  local status="$4"
  local weight="$5"
  local current_step="$6"

  local dir_path="${project_dir}/.context/directives/${dir_id}"
  mkdir -p "${dir_path}/projects"

  cat > "${dir_path}/directive.json" <<ENDJSON
{
  "title": "${title}",
  "status": "${status}",
  "weight": "${weight}",
  "current_step": "${current_step}",
  "created": "2026-03-08T10:00:00Z",
  "started_at": "2026-03-08T10:00:00Z",
  "updated_at": "2026-03-08T10:30:00Z",
  "pipeline": {
    "triage": { "status": "completed", "agent": "CEO", "output": { "summary": "Triaged as ${weight}" } },
    "read": { "status": "completed", "agent": "CEO", "output": { "summary": "Read directive" } },
    "context": { "status": "completed", "agent": "CEO", "output": { "summary": "Context loaded" } },
    "plan": { "status": "completed", "agent": "COO", "output": { "summary": "Plan created" } },
    "audit": { "status": "completed", "agent": "CTO", "output": { "summary": "Audit passed" } },
    "project-brainstorm": { "status": "completed", "agent": "CTO", "output": { "summary": "Tasks decomposed" } },
    "setup": { "status": "completed", "agent": "CEO", "output": { "summary": "Setup done" } },
    "execute": { "status": "active", "agent": "FS", "output": { "summary": "Building" } }
  }
}
ENDJSON
}

create_directive_full() {
  local project_dir="$1"
  local dir_id="$2"
  local title="$3"
  local status="$4"
  local weight="$5"
  local current_step="$6"

  local dir_path="${project_dir}/.context/directives/${dir_id}"
  mkdir -p "${dir_path}/projects"

  local challenge_status="skipped"
  local brainstorm_status="skipped"
  local approve_status="completed"

  if [[ "$weight" == "heavyweight" || "$weight" == "strategic" ]]; then
    challenge_status="completed"
    brainstorm_status="completed"
  fi
  if [[ "$weight" == "medium" ]]; then
    brainstorm_status="completed"
  fi
  if [[ "$weight" == "lightweight" ]]; then
    approve_status="skipped"
  fi

  cat > "${dir_path}/directive.json" <<ENDJSON
{
  "title": "${title}",
  "status": "${status}",
  "weight": "${weight}",
  "current_step": "${current_step}",
  "created": "2026-03-08T10:00:00Z",
  "started_at": "2026-03-08T10:00:00Z",
  "updated_at": "2026-03-08T10:30:00Z",
  "pipeline": {
    "triage": { "status": "completed", "agent": "CEO", "output": { "summary": "Triaged" } },
    "read": { "status": "completed", "agent": "CEO", "output": { "summary": "Read" } },
    "context": { "status": "completed", "agent": "CEO", "output": { "summary": "Context" } },
    "challenge": { "status": "${challenge_status}", "agent": "C-suite", "output": { "summary": "Challenged" } },
    "brainstorm": { "status": "${brainstorm_status}", "agent": "CTO", "output": { "summary": "Brainstormed" } },
    "plan": { "status": "completed", "agent": "COO", "output": { "summary": "Planned" } },
    "audit": { "status": "completed", "agent": "CTO", "output": { "summary": "Audited" } },
    "approve": { "status": "${approve_status}", "agent": "CEO", "output": { "summary": "Approved" } },
    "project-brainstorm": { "status": "completed", "agent": "CTO", "output": { "summary": "Tasks" } },
    "setup": { "status": "completed", "agent": "CEO", "output": { "summary": "Setup" } },
    "execute": { "status": "active", "agent": "FS", "output": { "summary": "Building" } }
  }
}
ENDJSON
}

create_project() {
  local project_dir="$1"
  local dir_id="$2"
  local proj_id="$3"
  local proj_title="$4"
  local proj_status="$5"

  local proj_path="${project_dir}/.context/directives/${dir_id}/projects/${proj_id}"
  mkdir -p "$proj_path"

  cat > "${proj_path}/project.json" <<ENDJSON
{
  "title": "${proj_title}",
  "status": "${proj_status}",
  "agent": ["dev1"],
  "reviewers": ["reviewer1"],
  "tasks": [
    { "title": "Task A", "status": "completed", "agent": "dev1", "dod": [{ "criterion": "Works", "met": true }] },
    { "title": "Task B", "status": "in_progress", "agent": "dev1", "dod": [{ "criterion": "Passes tests", "met": false }] },
    { "title": "Task C", "status": "pending", "agent": "dev1", "dod": [{ "criterion": "Reviewed", "met": false }] }
  ]
}
ENDJSON
}

# Platform → expected symlink dir mapping
platform_symlink_dir() {
  case "$1" in
    claude-code) echo ".claude" ;;
    aider)       echo ".aider" ;;
    gemini-cli)  echo ".gemini" ;;
    codex)       echo ".codex" ;;
    other)       echo "" ;;
  esac
}

ALL_PLATFORMS=(claude-code aider gemini-cli codex other)
ALL_PRESETS=(starter standard full)

preset_agent_count() {
  case "$1" in
    starter)  echo 5 ;;
    standard) echo 8 ;;
    full)     echo 12 ;;
  esac
}

# ═════════════════════════════════════════════════════════════════════════════
# SCENARIO 1: Init → Server → Agent Registry (ALL platforms × ALL presets)
# Real user: picks any platform + any preset, starts server, game loads agents
# ═════════════════════════════════════════════════════════════════════════════

test_platform_preset_to_server() {
  local platform="$1"
  local preset="$2"
  local expected_agents
  expected_agents="$(preset_agent_count "$preset")"
  local tag="${platform}/${preset}"

  log_section "Scenario 1: Init(${tag}) → Server → Agent Registry"

  local dir
  dir="$(create_test_dir "e2e-test-integ-${platform}-${preset}")"
  add_temp_dir "$dir"

  # Step 1: Init with specific platform
  run_gruai_init_with_platform "$dir" "$preset" "$platform" > /dev/null 2>&1 || true
  assert_dir_exists "${dir}/.gruai" "${tag}: init succeeded"

  # Step 2: Verify correct platform symlink
  local symlink_dir
  symlink_dir="$(platform_symlink_dir "$platform")"
  if [[ -n "$symlink_dir" ]]; then
    assert_symlink "${dir}/${symlink_dir}" ".gruai" "${tag}: ${symlink_dir}/ symlink -> .gruai/"
  else
    # 'other' platform: no symlink, just .gruai/
    local has_any_symlink=false
    for sl in .claude .aider .gemini .codex; do
      if [[ -L "${dir}/${sl}" ]]; then has_any_symlink=true; fi
    done
    if ! $has_any_symlink; then
      log_pass "${tag}: no platform symlinks (correct for 'other')"
    else
      log_fail "${tag}: unexpected symlink found for 'other' platform"
    fi
  fi

  # Step 3: Start server
  local port
  port="$(find_free_port)"
  if ! start_server "$dir" "$port"; then
    return
  fi
  log_pass "${tag}: server started on port ${port}"

  # Step 4: Verify agent registry via API
  local agent_count
  agent_count="$(api_query "$port" "/api/agent-registry" "print(len(data.get('agents',[])))")"
  assert_eq "$agent_count" "$expected_agents" "${tag}: API returns ${expected_agents} agents"

  # Step 5: Verify CEO is first with isPlayer
  local ceo_id
  ceo_id="$(api_query "$port" "/api/agent-registry" "print(data['agents'][0]['id'])")"
  assert_eq "$ceo_id" "ceo" "${tag}: CEO is first agent"

  local ceo_is_player
  ceo_is_player="$(api_query "$port" "/api/agent-registry" "print(data['agents'][0].get('game',{}).get('isPlayer',False))")"
  assert_eq "$ceo_is_player" "True" "${tag}: CEO has isPlayer=true"

  # Step 6: ALL agents have game config
  local agents_with_game
  agents_with_game="$(api_query "$port" "/api/agent-registry" \
    "print(sum(1 for a in data['agents'] if a.get('game')))")"
  assert_eq "$agents_with_game" "$expected_agents" "${tag}: all ${expected_agents} agents have game config"

  # Step 7: No duplicate seatIds
  local unique_seats
  unique_seats="$(api_query "$port" "/api/agent-registry" \
    "seats=[a['game']['seatId'] for a in data['agents'] if a.get('game')]; print(len(seats)==len(set(seats)))")"
  assert_eq "$unique_seats" "True" "${tag}: no duplicate seatIds"

  # Step 8: No duplicate palettes
  local unique_palettes
  unique_palettes="$(api_query "$port" "/api/agent-registry" \
    "p=[a['game']['palette'] for a in data['agents'] if a.get('game')]; print(len(p)==len(set(p)))")"
  assert_eq "$unique_palettes" "True" "${tag}: no duplicate palettes"

  # Step 9: Agent names are real (not template placeholders)
  local names_valid
  names_valid="$(api_query "$port" "/api/agent-registry" \
    "print(all(len(a.get('name',''))>2 and '{{' not in a.get('name','') for a in data['agents']))")"
  assert_eq "$names_valid" "True" "${tag}: all agent names are real (no placeholders)"

  # Step 10: Game configs have required fields
  local game_fields_valid
  game_fields_valid="$(api_query "$port" "/api/agent-registry" \
    "print(all('palette' in a['game'] and 'seatId' in a['game'] and 'position' in a['game'] and 'color' in a['game'] for a in data['agents'] if a.get('game')))")"
  assert_eq "$game_fields_valid" "True" "${tag}: all game configs have palette/seatId/position/color"

  # Step 11: firstName present for all non-CEO agents
  local firstname_valid
  firstname_valid="$(api_query "$port" "/api/agent-registry" \
    "print(all(a.get('firstName','')!='' for a in data['agents'] if a['id']!='ceo'))")"
  assert_eq "$firstname_valid" "True" "${tag}: all non-CEO agents have firstName"

  # Step 12: Health endpoint works
  local health_status
  health_status="$(api_query "$port" "/api/health" "print(data.get('status',''))")"
  assert_eq "$health_status" "ok" "${tag}: /api/health returns ok"

  # Step 13: Unknown /api/* returns 404 JSON (not SPA fallback)
  local api_404
  api_404="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}/api/nonexistent" 2>/dev/null)"
  assert_eq "$api_404" "404" "${tag}: unknown /api/* returns 404"

  kill_server_on_port "$port"
}

# Run ALL 5 platforms × ALL 3 presets = 15 combinations
for platform in "${ALL_PLATFORMS[@]}"; do
  for preset in "${ALL_PRESETS[@]}"; do
    test_platform_preset_to_server "$platform" "$preset"
  done
done

# ═════════════════════════════════════════════════════════════════════════════
# SCENARIO 2: Init → Directive → Server shows it in API (multiple platforms)
# Real user on different platforms creates directives, sees them on dashboard
# ═════════════════════════════════════════════════════════════════════════════

test_directive_chain() {
  local platform="$1"
  local preset="$2"
  local tag="${platform}/${preset}"

  log_section "Scenario 2: Directive chain (${tag})"

  local dir
  dir="$(create_test_dir "e2e-test-integ-dir-${platform}-${preset}")"
  add_temp_dir "$dir"

  run_gruai_init_with_platform "$dir" "$preset" "$platform" > /dev/null 2>&1 || true

  # Create an active directive
  create_directive "$dir" "build-feature" "Build Feature X" "in_progress" "medium" "execute"
  create_project "$dir" "build-feature" "impl" "Implementation" "in_progress"

  local port
  port="$(find_free_port)"
  start_server "$dir" "$port" || return

  # Verify directive appears
  local active_count
  active_count="$(api_query "$port" "/api/state" "print(len(data.get('activeDirectives',[])))")"
  assert_eq "$active_count" "1" "${tag}: activeDirectives=1"

  local dir_name
  dir_name="$(api_query "$port" "/api/state" "print(data['activeDirectives'][0]['directiveName'])")"
  assert_eq "$dir_name" "build-feature" "${tag}: directive name correct"

  local dir_status
  dir_status="$(api_query "$port" "/api/state" "print(data['activeDirectives'][0]['status'])")"
  assert_eq "$dir_status" "in_progress" "${tag}: directive status = in_progress"

  local current_step
  current_step="$(api_query "$port" "/api/state" "print(data['activeDirectives'][0]['currentStepId'])")"
  assert_eq "$current_step" "execute" "${tag}: current_step = execute"

  local pipeline_count
  pipeline_count="$(api_query "$port" "/api/state" "print(len(data['activeDirectives'][0].get('pipelineSteps',[])))")"
  assert_eq "$pipeline_count" "14" "${tag}: 14 pipeline steps"

  # Project + task chain
  local proj_count
  proj_count="$(api_query "$port" "/api/state" "print(len(data['activeDirectives'][0].get('projects',[])))")"
  assert_eq "$proj_count" "1" "${tag}: 1 project"

  local task_count
  task_count="$(api_query "$port" "/api/state" \
    "print(len(data['activeDirectives'][0]['projects'][0].get('tasks',[])))")"
  assert_eq "$task_count" "3" "${tag}: 3 tasks"

  local completed_tasks
  completed_tasks="$(api_query "$port" "/api/state" \
    "print(sum(1 for t in data['activeDirectives'][0]['projects'][0]['tasks'] if t['status']=='completed'))")"
  assert_eq "$completed_tasks" "1" "${tag}: 1 task completed"

  # WebSocket delivers same data
  local ws_active
  ws_active="$(node -e "
const WebSocket = require('${GRUAI_PACKAGE_ROOT}/node_modules/ws');
const ws = new WebSocket('ws://localhost:${port}');
ws.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.type === 'full_state') {
    console.log((m.payload.activeDirectives || []).length);
    ws.close();
    process.exit(0);
  }
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 5000);
" 2>/dev/null)" || ws_active="error"
  assert_eq "$ws_active" "1" "${tag}: WebSocket full_state has activeDirectives=1"

  kill_server_on_port "$port"
}

# Run directive chain on 3 platforms × 2 presets = 6 combinations
test_directive_chain "claude-code" "starter"
test_directive_chain "aider" "standard"
test_directive_chain "gemini-cli" "full"
test_directive_chain "codex" "starter"
test_directive_chain "other" "standard"
test_directive_chain "claude-code" "full"

# ═════════════════════════════════════════════════════════════════════════════
# SCENARIO 3: Pipeline weight classes — skipped steps (multiple platforms)
# Real user: different directive weights skip different pipeline steps
# ═════════════════════════════════════════════════════════════════════════════

test_weight_class() {
  local weight="$1"
  local expected_skipped="$2"
  local platform="$3"
  local tag="${platform}/${weight}"

  log_section "Scenario 3: Weight class ${tag} — skipped steps"

  local dir
  dir="$(create_test_dir "e2e-test-integ-weight-${platform}-${weight}")"
  add_temp_dir "$dir"

  run_gruai_init_with_platform "$dir" "starter" "$platform" > /dev/null 2>&1 || true
  create_directive_full "$dir" "test-${weight}" "Test ${weight}" "in_progress" "$weight" "execute"

  local port
  port="$(find_free_port)"
  start_server "$dir" "$port" || return

  local skipped
  skipped="$(api_query "$port" "/api/state" \
    "steps=data['activeDirectives'][0].get('pipelineSteps',[]); print(','.join(s['id'] for s in steps if s['status']=='skipped') or 'none')")"
  assert_eq "$skipped" "$expected_skipped" "${tag}: skipped steps = ${expected_skipped}"

  local active_step
  active_step="$(api_query "$port" "/api/state" \
    "steps=data['activeDirectives'][0].get('pipelineSteps',[]); active=[s for s in steps if s['status']=='active']; print(active[0]['id'] if active else 'none')")"
  assert_eq "$active_step" "execute" "${tag}: active step = execute"

  local completed_steps
  completed_steps="$(api_query "$port" "/api/state" \
    "steps=data['activeDirectives'][0].get('pipelineSteps',[]); print(sum(1 for s in steps if s['status']=='completed'))")"
  assert_gt "$completed_steps" "5" "${tag}: has >5 completed steps"

  kill_server_on_port "$port"
}

# 3 weights × 3 platforms = 9 combinations
test_weight_class "lightweight" "challenge,brainstorm,approve" "claude-code"
test_weight_class "medium" "challenge" "claude-code"
test_weight_class "heavyweight" "none" "claude-code"
test_weight_class "lightweight" "challenge,brainstorm,approve" "aider"
test_weight_class "medium" "challenge" "codex"
test_weight_class "heavyweight" "none" "gemini-cli"
test_weight_class "lightweight" "challenge,brainstorm,approve" "other"
test_weight_class "medium" "challenge" "gemini-cli"
test_weight_class "heavyweight" "none" "aider"

# ═════════════════════════════════════════════════════════════════════════════
# SCENARIO 4: Multiple simultaneous directives (aider + full preset)
# Real user on aider with full team: has several directives in various states
# ═════════════════════════════════════════════════════════════════════════════

test_multi_directives() {
  local platform="$1"
  local preset="$2"
  local tag="${platform}/${preset}"

  log_section "Scenario 4: Multiple directives (${tag})"

  local dir
  dir="$(create_test_dir "e2e-test-integ-multi-${platform}")"
  add_temp_dir "$dir"

  run_gruai_init_with_platform "$dir" "$preset" "$platform" > /dev/null 2>&1 || true

  create_directive "$dir" "active-1" "Active One" "in_progress" "medium" "execute"
  create_directive "$dir" "active-2" "Active Two" "in_progress" "lightweight" "execute"

  mkdir -p "${dir}/.context/directives/awaiting-1"
  cat > "${dir}/.context/directives/awaiting-1/directive.json" <<'ENDJSON'
{
  "title": "Awaiting Approval",
  "status": "awaiting_completion",
  "weight": "medium",
  "current_step": "completion",
  "created": "2026-03-08T08:00:00Z",
  "started_at": "2026-03-08T08:00:00Z",
  "updated_at": "2026-03-08T09:00:00Z",
  "pipeline": {
    "triage": { "status": "completed" },
    "completion": { "status": "active" }
  }
}
ENDJSON

  mkdir -p "${dir}/.context/directives/done-1"
  cat > "${dir}/.context/directives/done-1/directive.json" <<'ENDJSON'
{
  "title": "Done Feature",
  "status": "completed",
  "weight": "lightweight",
  "current_step": "completion",
  "created": "2026-03-07T10:00:00Z",
  "updated_at": "2026-03-07T11:00:00Z"
}
ENDJSON

  mkdir -p "${dir}/.context/directives/failed-1"
  cat > "${dir}/.context/directives/failed-1/directive.json" <<'ENDJSON'
{
  "title": "Failed Feature",
  "status": "failed",
  "weight": "medium",
  "current_step": "execute",
  "created": "2026-03-06T10:00:00Z",
  "updated_at": "2026-03-06T12:00:00Z"
}
ENDJSON

  local port
  port="$(find_free_port)"
  start_server "$dir" "$port" || return

  local active_count
  active_count="$(api_query "$port" "/api/state" "print(len(data.get('activeDirectives',[])))")"
  assert_eq "$active_count" "3" "${tag}: 3 active directives (2 in_progress + 1 awaiting)"

  local history_count
  history_count="$(api_query "$port" "/api/state" "print(len(data.get('directiveHistory',[])))")"
  assert_eq "$history_count" "6" "${tag}: 6 total in history (includes welcome)"

  local completed_in_active
  completed_in_active="$(api_query "$port" "/api/state" \
    "print(sum(1 for d in data.get('activeDirectives',[]) if d['status']=='completed'))")"
  assert_eq "$completed_in_active" "0" "${tag}: completed not in activeDirectives"

  local awaiting_in_active
  awaiting_in_active="$(api_query "$port" "/api/state" \
    "print(sum(1 for d in data.get('activeDirectives',[]) if d['status']=='awaiting_completion'))")"
  assert_eq "$awaiting_in_active" "1" "${tag}: awaiting_completion IS in activeDirectives"

  kill_server_on_port "$port"
}

test_multi_directives "claude-code" "starter"
test_multi_directives "aider" "full"
test_multi_directives "codex" "standard"

# ═════════════════════════════════════════════════════════════════════════════
# SCENARIO 5: Live directive watcher (multiple platforms)
# Real user: starts server, then creates directive — dashboard updates live
# ═════════════════════════════════════════════════════════════════════════════

test_live_watcher() {
  local platform="$1"
  local preset="$2"
  local tag="${platform}/${preset}"

  log_section "Scenario 5: Live watcher (${tag})"

  local dir
  dir="$(create_test_dir "e2e-test-integ-live-${platform}")"
  add_temp_dir "$dir"

  run_gruai_init_with_platform "$dir" "$preset" "$platform" > /dev/null 2>&1 || true

  local port
  port="$(find_free_port)"
  start_server "$dir" "$port" || return

  local initial_active
  initial_active="$(api_query "$port" "/api/state" "print(len(data.get('activeDirectives',[])))")"
  assert_eq "$initial_active" "0" "${tag}: initially 0 active directives"

  create_directive "$dir" "live-feature" "Live Feature" "in_progress" "medium" "execute"
  sleep 6

  local after_active
  after_active="$(api_query "$port" "/api/state" "print(len(data.get('activeDirectives',[])))")"
  assert_eq "$after_active" "1" "${tag}: watcher detected new directive (active=1)"

  local live_name
  live_name="$(api_query "$port" "/api/state" "print(data['activeDirectives'][0]['directiveName'])")"
  assert_eq "$live_name" "live-feature" "${tag}: directive name = live-feature"

  sed -i.bak 's/"current_step": "execute"/"current_step": "review-gate"/' \
    "${dir}/.context/directives/live-feature/directive.json"
  rm -f "${dir}/.context/directives/live-feature/directive.json.bak"

  sleep 6

  local updated_step
  updated_step="$(api_query "$port" "/api/state" "print(data['activeDirectives'][0]['currentStepId'])")"
  assert_eq "$updated_step" "review-gate" "${tag}: watcher detected step change to review-gate"

  kill_server_on_port "$port"
}

test_live_watcher "claude-code" "starter"
test_live_watcher "aider" "standard"
test_live_watcher "codex" "full"

# ═════════════════════════════════════════════════════════════════════════════
# SCENARIO 6: Agent name flow-through (multiple platforms + presets)
# Real user: generates agents, sees correct names in API + personality files
# ═════════════════════════════════════════════════════════════════════════════

test_name_flowthrough() {
  local platform="$1"
  local preset="$2"
  local expected_agents
  expected_agents="$(preset_agent_count "$preset")"
  local tag="${platform}/${preset}"

  log_section "Scenario 6: Name flow-through (${tag})"

  local dir
  dir="$(create_test_dir "e2e-test-integ-names-${platform}-${preset}")"
  add_temp_dir "$dir"

  run_gruai_init_with_platform "$dir" "$preset" "$platform" > /dev/null 2>&1 || true

  local port
  port="$(find_free_port)"
  start_server "$dir" "$port" || return

  # API matches file registry
  local file_names
  file_names="$(jq -r '[.agents[].name] | sort | join(",")' "${dir}/.gruai/agent-registry.json")"
  local api_names
  api_names="$(api_query "$port" "/api/agent-registry" \
    "print(','.join(sorted(a['name'] for a in data['agents'])))")"
  assert_eq "$api_names" "$file_names" "${tag}: API matches file registry"

  # All non-CEO agents have first+last name
  local names_have_space
  names_have_space="$(api_query "$port" "/api/agent-registry" \
    "print(all(' ' in a['name'] for a in data['agents'] if a['id'] != 'ceo'))")"
  assert_eq "$names_have_space" "True" "${tag}: all non-CEO agents have first+last name"

  # Personality files have no {{NAME}} placeholder
  local local_check_pass=true
  for agent_file in "${dir}"/.gruai/agents/*.md; do
    if [[ -f "$agent_file" ]]; then
      if grep -q '{{NAME}}' "$agent_file" 2>/dev/null; then
        log_fail "${tag}: ${agent_file} still has {{NAME}} placeholder"
        local_check_pass=false
      fi
    fi
  done
  if $local_check_pass; then
    log_pass "${tag}: no personality files have {{NAME}} placeholder"
  fi

  # Agent count matches preset
  local agent_count
  agent_count="$(api_query "$port" "/api/agent-registry" "print(len(data.get('agents',[])))")"
  assert_eq "$agent_count" "$expected_agents" "${tag}: agent count = ${expected_agents}"

  kill_server_on_port "$port"
}

test_name_flowthrough "claude-code" "starter"
test_name_flowthrough "aider" "standard"
test_name_flowthrough "gemini-cli" "full"
test_name_flowthrough "codex" "starter"
test_name_flowthrough "other" "full"

# ═════════════════════════════════════════════════════════════════════════════
# SCENARIO 7: Project + Task detail chain (multiple platforms)
# Real user: directive has projects with tasks, DOD — all visible in API
# ═════════════════════════════════════════════════════════════════════════════

test_project_task_chain() {
  local platform="$1"
  local preset="$2"
  local tag="${platform}/${preset}"

  log_section "Scenario 7: Project/task detail (${tag})"

  local dir
  dir="$(create_test_dir "e2e-test-integ-tasks-${platform}")"
  add_temp_dir "$dir"

  run_gruai_init_with_platform "$dir" "$preset" "$platform" > /dev/null 2>&1 || true
  create_directive "$dir" "task-dir" "Task Directive" "in_progress" "medium" "execute"

  mkdir -p "${dir}/.context/directives/task-dir/projects/proj-a"
  cat > "${dir}/.context/directives/task-dir/projects/proj-a/project.json" <<'ENDJSON'
{
  "title": "Project Alpha",
  "status": "in_progress",
  "agent": ["dev-a"],
  "reviewers": ["rev-a"],
  "tasks": [
    { "title": "Setup", "status": "completed", "agent": "dev-a", "dod": [{"criterion":"Scaffolded","met":true}] },
    { "title": "Build", "status": "in_progress", "agent": "dev-a", "dod": [{"criterion":"Tests pass","met":false}] }
  ]
}
ENDJSON

  mkdir -p "${dir}/.context/directives/task-dir/projects/proj-b"
  cat > "${dir}/.context/directives/task-dir/projects/proj-b/project.json" <<'ENDJSON'
{
  "title": "Project Beta",
  "status": "pending",
  "agent": ["dev-b"],
  "reviewers": ["rev-b"],
  "tasks": [
    { "title": "Research", "status": "pending", "agent": "dev-b", "dod": [{"criterion":"Report written","met":false}] },
    { "title": "Implement", "status": "pending", "agent": "dev-b", "dod": [{"criterion":"Code done","met":false}] },
    { "title": "Test", "status": "pending", "agent": "dev-b", "dod": [{"criterion":"Coverage >80%","met":false}] }
  ]
}
ENDJSON

  local port
  port="$(find_free_port)"
  start_server "$dir" "$port" || return

  local proj_count
  proj_count="$(api_query "$port" "/api/state" \
    "print(len(data['activeDirectives'][0].get('projects',[])))")"
  assert_eq "$proj_count" "2" "${tag}: 2 projects visible"

  local proj_a_tasks
  proj_a_tasks="$(api_query "$port" "/api/state" \
    "ps=data['activeDirectives'][0]['projects']; pa=[p for p in ps if p['id']=='proj-a']; print(len(pa[0]['tasks']) if pa else 0)")"
  assert_eq "$proj_a_tasks" "2" "${tag}: proj-a has 2 tasks"

  local proj_b_tasks
  proj_b_tasks="$(api_query "$port" "/api/state" \
    "ps=data['activeDirectives'][0]['projects']; pb=[p for p in ps if p['id']=='proj-b']; print(len(pb[0]['tasks']) if pb else 0)")"
  assert_eq "$proj_b_tasks" "3" "${tag}: proj-b has 3 tasks"

  local has_dod
  has_dod="$(api_query "$port" "/api/state" \
    "ps=data['activeDirectives'][0]['projects']; t=ps[0]['tasks'][0]; print('dod' in t and len(t['dod'])>0)")"
  assert_eq "$has_dod" "True" "${tag}: DOD data present in task"

  local has_agent
  has_agent="$(api_query "$port" "/api/state" \
    "ps=data['activeDirectives'][0]['projects']; print(len(ps[0].get('agent',[]))>0)")"
  assert_eq "$has_agent" "True" "${tag}: project has agent array"

  local has_reviewers
  has_reviewers="$(api_query "$port" "/api/state" \
    "ps=data['activeDirectives'][0]['projects']; print(len(ps[0].get('reviewers',[]))>0)")"
  assert_eq "$has_reviewers" "True" "${tag}: project has reviewers array"

  kill_server_on_port "$port"
}

test_project_task_chain "claude-code" "standard"
test_project_task_chain "aider" "full"
test_project_task_chain "codex" "starter"

# ═════════════════════════════════════════════════════════════════════════════
# SCENARIO 8: Edge — corrupt directive.json doesn't crash server
# (tested on non-claude-code platform to verify edge resilience)
# ═════════════════════════════════════════════════════════════════════════════

test_corrupt_resilience() {
  local platform="$1"
  local tag="${platform}"

  log_section "Scenario 8: Corrupt JSON resilience (${tag})"

  local dir
  dir="$(create_test_dir "e2e-test-integ-corrupt-${platform}")"
  add_temp_dir "$dir"

  run_gruai_init_with_platform "$dir" "starter" "$platform" > /dev/null 2>&1 || true

  create_directive "$dir" "good-dir" "Good Directive" "in_progress" "medium" "execute"

  mkdir -p "${dir}/.context/directives/corrupt-dir"
  echo "{ this is not valid json !!!" > "${dir}/.context/directives/corrupt-dir/directive.json"

  mkdir -p "${dir}/.context/directives/empty-dir"
  echo "{}" > "${dir}/.context/directives/empty-dir/directive.json"

  local port
  port="$(find_free_port)"
  start_server "$dir" "$port" || return

  local health
  health="$(api_query "$port" "/api/health" "print(data.get('status',''))")"
  assert_eq "$health" "ok" "${tag}: server still healthy"

  local active
  active="$(api_query "$port" "/api/state" "print(len(data.get('activeDirectives',[])))")"
  assert_eq "$active" "1" "${tag}: good directive still visible (active=1)"

  local good_name
  good_name="$(api_query "$port" "/api/state" "print(data['activeDirectives'][0]['directiveName'])")"
  assert_eq "$good_name" "good-dir" "${tag}: good directive name correct"

  kill_server_on_port "$port"
}

test_corrupt_resilience "claude-code"
test_corrupt_resilience "gemini-cli"

# ═════════════════════════════════════════════════════════════════════════════
# SCENARIO 9: Edge — server starts with no directives
# ═════════════════════════════════════════════════════════════════════════════

test_empty_project() {
  local platform="$1"
  local preset="$2"
  local expected_agents
  expected_agents="$(preset_agent_count "$preset")"
  local tag="${platform}/${preset}"

  log_section "Scenario 9: Empty project (${tag})"

  local dir
  dir="$(create_test_dir "e2e-test-integ-empty-${platform}")"
  add_temp_dir "$dir"

  run_gruai_init_with_platform "$dir" "$preset" "$platform" > /dev/null 2>&1 || true
  rm -rf "${dir}/.context/directives/welcome"

  local port
  port="$(find_free_port)"
  start_server "$dir" "$port" || return

  local active
  active="$(api_query "$port" "/api/state" "print(len(data.get('activeDirectives',[])))")"
  assert_eq "$active" "0" "${tag}: 0 active directives"

  local agent_count
  agent_count="$(api_query "$port" "/api/agent-registry" "print(len(data.get('agents',[])))")"
  assert_eq "$agent_count" "$expected_agents" "${tag}: agent registry works (${expected_agents} agents)"

  kill_server_on_port "$port"
}

test_empty_project "claude-code" "starter"
test_empty_project "aider" "full"
test_empty_project "other" "standard"

# ═════════════════════════════════════════════════════════════════════════════
# SCENARIO 10: Awaiting completion — needsAction flag (multiple platforms)
# Real user: directive done, waiting for CEO approval on dashboard
# ═════════════════════════════════════════════════════════════════════════════

test_awaiting_completion() {
  local platform="$1"
  local tag="${platform}"

  log_section "Scenario 10: Awaiting completion (${tag})"

  local dir
  dir="$(create_test_dir "e2e-test-integ-awaiting-${platform}")"
  add_temp_dir "$dir"

  run_gruai_init_with_platform "$dir" "starter" "$platform" > /dev/null 2>&1 || true

  mkdir -p "${dir}/.context/directives/await-dir"
  cat > "${dir}/.context/directives/await-dir/directive.json" <<'ENDJSON'
{
  "title": "Awaiting CEO",
  "status": "awaiting_completion",
  "weight": "medium",
  "current_step": "completion",
  "created": "2026-03-08T08:00:00Z",
  "started_at": "2026-03-08T08:00:00Z",
  "updated_at": "2026-03-08T09:00:00Z",
  "pipeline": {
    "triage": { "status": "completed", "output": { "summary": "Done" } },
    "read": { "status": "completed", "output": { "summary": "Done" } },
    "context": { "status": "completed", "output": { "summary": "Done" } },
    "plan": { "status": "completed", "output": { "summary": "Done" } },
    "audit": { "status": "completed", "output": { "summary": "Done" } },
    "approve": { "status": "completed", "output": { "summary": "Done" } },
    "project-brainstorm": { "status": "completed", "output": { "summary": "Done" } },
    "setup": { "status": "completed", "output": { "summary": "Done" } },
    "execute": { "status": "completed", "output": { "summary": "Done" } },
    "review-gate": { "status": "completed", "output": { "summary": "Done" } },
    "wrapup": { "status": "completed", "output": { "summary": "Done" } },
    "completion": { "status": "active", "output": { "summary": "Awaiting CEO" } }
  }
}
ENDJSON

  local port
  port="$(find_free_port)"
  start_server "$dir" "$port" || return

  local in_active
  in_active="$(api_query "$port" "/api/state" \
    "print(any(d['directiveName']=='await-dir' for d in data.get('activeDirectives',[])))")"
  assert_eq "$in_active" "True" "${tag}: appears in activeDirectives"

  local needs_action
  needs_action="$(api_query "$port" "/api/state" \
    "d=[x for x in data['activeDirectives'] if x['directiveName']=='await-dir'][0]; cs=[s for s in d['pipelineSteps'] if s['id']=='completion']; print(cs[0].get('needsAction',False) if cs else False)")"
  assert_eq "$needs_action" "True" "${tag}: completion step has needsAction=true"

  local dir_status
  dir_status="$(api_query "$port" "/api/state" \
    "d=[x for x in data['activeDirectives'] if x['directiveName']=='await-dir'][0]; print(d['status'])")"
  assert_eq "$dir_status" "awaiting_completion" "${tag}: status = awaiting_completion"

  kill_server_on_port "$port"
}

test_awaiting_completion "claude-code"
test_awaiting_completion "aider"
test_awaiting_completion "codex"

# ═════════════════════════════════════════════════════════════════════════════
# Results
# ═════════════════════════════════════════════════════════════════════════════

DIM_ELAPSED="$(stop_timer "$DIM_START")"
write_result_json "$DIM_NAME" "$DIM_ELAPSED"

log_section "dim-integration results"
printf "  Pass: %d  Fail: %d  Time: %d ms\n\n" "$_PASS_COUNT" "$_FAIL_COUNT" "$DIM_ELAPSED"

if (( _FAIL_COUNT > 0 )); then
  exit 1
fi
