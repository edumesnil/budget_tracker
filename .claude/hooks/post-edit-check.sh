#!/bin/bash
# Claude Code hook: runs the anti-pattern scanner after file edits
# Only scans .tsx/.ts files in src/ to avoid noise

FILE_PATH="$CLAUDE_FILE_PATH"

# Only check relevant files
if [[ ! "$FILE_PATH" =~ \.(tsx|ts)$ ]]; then
  exit 0
fi

# Skip theme/config files (they have different rules handled by the scanner)
# Skip node_modules, styled-system, etc.
if [[ "$FILE_PATH" =~ node_modules|styled-system|\.next|dist ]]; then
  exit 0
fi

# Only scan src/ files
if [[ ! "$FILE_PATH" =~ ^src/ ]] && [[ ! "$FILE_PATH" =~ /src/ ]]; then
  exit 0
fi

# Run the scanner — only HIGH and CRITICAL
SCRIPT_DIR="$(cd "$(dirname "$0")/../panda-token-enforcer/scripts" && pwd)"
RESULT=$(python3 "$SCRIPT_DIR/check-antipatterns.py" "$FILE_PATH" --severity=high 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
  # CRITICAL violations — block and show
  echo "$RESULT"
  echo ""
  echo "⛔ CRITICAL violations found. Fix before continuing."
  exit 1
elif [ $EXIT_CODE -eq 1 ]; then
  # HIGH violations — warn but don't block
  echo "$RESULT"
  echo ""
  echo "⚠️  HIGH severity violations detected. Consider fixing."
  exit 0
else
  exit 0
fi
