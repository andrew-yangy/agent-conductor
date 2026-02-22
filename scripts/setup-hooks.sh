#!/usr/bin/env bash
set -euo pipefail

SETTINGS_FILE="$HOME/.claude/settings.json"
CONDUCTOR_URL="http://localhost:4444/api/events"

echo "=== Conductor Hook Setup ==="
echo ""

# Check for jq
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    echo "Install it with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Ensure ~/.claude directory exists
if [ ! -d "$HOME/.claude" ]; then
    echo "Creating ~/.claude directory..."
    mkdir -p "$HOME/.claude"
fi

# Ensure settings.json exists
if [ ! -f "$SETTINGS_FILE" ]; then
    echo "Creating $SETTINGS_FILE..."
    echo '{}' > "$SETTINGS_FILE"
fi

# Validate existing settings.json is valid JSON
if ! jq empty "$SETTINGS_FILE" 2>/dev/null; then
    echo "Error: $SETTINGS_FILE contains invalid JSON. Please fix it manually."
    exit 1
fi

echo "Reading existing settings from $SETTINGS_FILE..."

# Define the hook commands
NOTIFICATION_CMD="curl -s -X POST ${CONDUCTOR_URL} -H 'Content-Type: application/json' -d '{\"type\":\"notification\",\"sessionId\":\"'\"\\$CLAUDE_SESSION_ID\"'\",\"timestamp\":\"'\"\\$(date -u +%Y-%m-%dT%H:%M:%SZ)\"'\",\"message\":\"'\"\\${CLAUDE_NOTIFICATION:-Notification}\"'\",\"project\":\"'\"\\$CLAUDE_PROJECT_DIR\"'\"}' > /dev/null 2>&1 &"

STOP_CMD="curl -s -X POST ${CONDUCTOR_URL} -H 'Content-Type: application/json' -d '{\"type\":\"stop\",\"sessionId\":\"'\"\\$CLAUDE_SESSION_ID\"'\",\"timestamp\":\"'\"\\$(date -u +%Y-%m-%dT%H:%M:%SZ)\"'\",\"message\":\"Session stopped\",\"project\":\"'\"\\$CLAUDE_PROJECT_DIR\"'\"}' > /dev/null 2>&1 &"

# Build the new hooks object
CONDUCTOR_HOOKS=$(jq -n \
    --arg notif_cmd "$NOTIFICATION_CMD" \
    --arg stop_cmd "$STOP_CMD" \
    '{
        "Notification": [
            {
                "matcher": "",
                "hooks": [
                    {
                        "type": "command",
                        "command": $notif_cmd
                    }
                ]
            }
        ],
        "Stop": [
            {
                "matcher": "",
                "hooks": [
                    {
                        "type": "command",
                        "command": $stop_cmd
                    }
                ]
            }
        ]
    }')

# Merge hooks into existing settings
# Strategy: deep merge so existing hooks for other events are preserved,
# and existing entries within Notification/Stop arrays are preserved too.
EXISTING=$(cat "$SETTINGS_FILE")

# Check if settings already has hooks
if echo "$EXISTING" | jq -e '.hooks' > /dev/null 2>&1; then
    # Merge: for each hook event, append our entries to existing arrays
    MERGED=$(echo "$EXISTING" | jq \
        --argjson conductor "$CONDUCTOR_HOOKS" \
        '
        # First, remove any existing Conductor hooks (localhost:4444) to avoid duplicates
        .hooks = (
            (.hooks // {}) |
            to_entries |
            map(
                .value = [
                    .value[] |
                    select(
                        .hooks | all(.command | contains("localhost:4444/api/events") | not)
                    )
                ]
            ) |
            from_entries
        ) |
        # Now append the Conductor hooks
        .hooks.Notification = ((.hooks.Notification // []) + $conductor.Notification) |
        .hooks.Stop = ((.hooks.Stop // []) + $conductor.Stop)
        ')
else
    # No existing hooks — just add them
    MERGED=$(echo "$EXISTING" | jq --argjson conductor "$CONDUCTOR_HOOKS" '. + { hooks: $conductor }')
fi

# Write back
echo "$MERGED" | jq '.' > "$SETTINGS_FILE"

echo ""
echo "Hooks installed successfully!"
echo ""
echo "Added to $SETTINGS_FILE:"
echo "  - Notification hook: POSTs to $CONDUCTOR_URL on Claude notifications"
echo "  - Stop hook: POSTs to $CONDUCTOR_URL when Claude session stops"
echo ""
echo "Run 'scripts/uninstall-hooks.sh' to remove Conductor hooks."
