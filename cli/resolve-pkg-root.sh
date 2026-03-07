#!/usr/bin/env bash
# resolve-pkg-root.sh — Find the gru-ai package root directory.
#
# Usage:
#   GRUAI_ROOT="$(bash "$(npm root)/gru-ai/cli/resolve-pkg-root.sh")"
#   # or source it:
#   source "$(npm root)/gru-ai/cli/resolve-pkg-root.sh"
#   echo "$GRUAI_ROOT"
#
# How it works:
#   Walks up from this script's own location to find the nearest directory
#   containing package.json with "name": "gru-ai". This works for:
#   - Normal npm install (node_modules/gru-ai/cli/resolve-pkg-root.sh)
#   - npm link / symlinked installs (resolves symlinks first)
#   - Running from source in the dev repo
#
# Output:
#   Prints the absolute path to the gru-ai package root on stdout.
#   Sets GRUAI_ROOT environment variable.
#   Exits 1 if the package root cannot be found.

set -euo pipefail

# Resolve symlinks to get the real path of this script
if command -v realpath >/dev/null 2>&1; then
  SCRIPT_DIR="$(dirname "$(realpath "$0")")"
elif command -v readlink >/dev/null 2>&1; then
  # macOS readlink -f may not exist, but GNU readlink does
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
else
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

# Walk up from script dir to find package.json with name "gru-ai"
dir="$SCRIPT_DIR"
while [ "$dir" != "/" ]; do
  if [ -f "$dir/package.json" ]; then
    # Check if this is the gru-ai package
    if grep -q '"name":[[:space:]]*"gru-ai"' "$dir/package.json" 2>/dev/null; then
      GRUAI_ROOT="$dir"
      echo "$GRUAI_ROOT"
      exit 0
    fi
  fi
  dir="$(dirname "$dir")"
done

echo "ERROR: Could not find gru-ai package root from $SCRIPT_DIR" >&2
exit 1
