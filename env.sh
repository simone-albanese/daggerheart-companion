#!/bin/sh
# Put the project-local Node toolchain first on PATH.
#
#   . ./env.sh          then:  npm run dev / npm test / npx tsx tools/...
#
# The repo ships no Node of its own; `.tools/node` is created by:
#   curl -L https://nodejs.org/dist/v24.19.0/node-v24.19.0-<platform>.tar.xz \
#     | tar -xJ -C .tools && mv .tools/node-v24.19.0-<platform> .tools/node
#
# It exists because the system Homebrew Node on the author's machine is broken
# (a dangling libllhttp link after an upgrade). Keeping the toolchain inside the
# project means nothing outside it has to be repaired or reinstalled.
_root="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
if [ -x "$_root/.tools/node/bin/node" ]; then
  PATH="$_root/.tools/node/bin:$PATH"
  export PATH
  echo "node $(node -v) / npm $(npm -v)  [project-local]"
else
  echo "warning: .tools/node not found; using whatever node is on PATH" >&2
fi
unset _root
