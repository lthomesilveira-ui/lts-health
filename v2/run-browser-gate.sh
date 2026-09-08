#!/usr/bin/env bash
set -euo pipefail

test_file="${1:?browser smoke file is required}"
attempt_log="$(mktemp)"
trap 'rm -f "$attempt_log"' EXIT

if node "$test_file" 2>&1 | tee "$attempt_log"; then
  exit 0
fi

if ! grep -Eq 'TimeoutError|ERR_CONNECTION_REFUSED|page\.goto: Timeout' "$attempt_log"; then
  exit 1
fi

echo "::warning::Transient browser navigation failure in ${test_file}; retrying once"
sleep 2
node "$test_file"
