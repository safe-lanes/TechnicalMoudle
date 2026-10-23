#!/usr/bin/env bash
set -euo pipefail

# Scope the workaround to this development process. The environment's loader
# overrides can stall Node/Vite startup; Nix's native executable has its own
# library paths. Application configuration and secrets remain inherited.
unset LD_AUDIT LD_LIBRARY_PATH

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
node_binary="$(command -v node)"

# Keep the declared runtime version, but bypass its shell wrapper so the
# wrapper cannot re-enable the loader overrides. Resolve the target at runtime
# rather than pinning a machine-specific Nix store hash.
if [[ "$(head -c 2 "$node_binary")" == '#!' ]]; then
  native_node="$(sed -n 's/^exec "\([^"]*\)" "\$@"$/\1/p' "$node_binary")"
  if [[ -z "$native_node" || ! -x "$native_node" ]]; then
    echo "Cannot resolve the native Node executable from the installed launcher." >&2
    exit 1
  fi
  node_binary="$native_node"
fi

export NODE_ENV=development
exec "$node_binary" node_modules/tsx/dist/cli.mjs watch --clear-screen=false server/index.ts
