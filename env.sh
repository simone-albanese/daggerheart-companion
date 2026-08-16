#!/bin/sh
# Put the project-local Node toolchain first on PATH.
#
#   . ./env.sh          then:  npm run dev / npm test / npx tsx tools/...
#
# Why this exists
# ---------------
# The project targets the Node major written in `.nvmrc`, because that is the
# one CI runs and the one the deploy runs; nothing else is verified against
# this tree. Machines do not agree with that by default - the one this is
# developed on is two majors ahead - so there has to be some way to run the
# version the gate runs.
#
# If you already manage Node per project (nvm, fnm, asdf, mise, Volta), use it
# and ignore this file: they all read `.nvmrc`, which is the same single source
# the workflows read. This script is for the case where you would rather not
# install a version manager, and would rather not move a system Node that other
# projects on the same machine are relying on.
#
# It does NOT exist because Homebrew's Node is broken. It did once - a dangling
# libllhttp link after an upgrade - and that was repaired. The old reason is
# recorded here in the past tense only so that nobody restores it from an older
# checkout and starts believing it again.
#
# The repo ships no Node of its own. To create `.tools/node`, take the current
# release of the major in `.nvmrc` from https://nodejs.org/dist/ and unpack it
# so that `.tools/node/bin/node` exists. No version is written down here on
# purpose: `.nvmrc` is the only place this repo names one. `.tools/` is
# gitignored.
_root="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
if [ -x "$_root/.tools/node/bin/node" ]; then
  PATH="$_root/.tools/node/bin:$PATH"
  export PATH
  echo "node $(node -v) / npm $(npm -v)  [project-local]"
else
  echo "warning: .tools/node not found; using whatever node is on PATH" >&2
fi

# A rationale nothing checks is the next stale comment. This is the one claim
# the file makes that can be tested, so it is tested here, where it costs a
# millisecond - rather than left to surface as a CI failure on a runner that is
# not the machine the mismatch is on.
_want=$(sed -n '1s/^[[:space:]]*v\{0,1\}\([0-9][0-9]*\).*/\1/p' "$_root/.nvmrc" 2>/dev/null)
_have=$(node -v 2>/dev/null) || _have=''
_have=${_have#v}
_have=${_have%%.*}
if [ -n "$_want" ] && [ -n "$_have" ] && [ "$_want" != "$_have" ]; then
  echo "warning: node $_have is on PATH, but .nvmrc says $_want - that is the major CI runs" >&2
fi
unset _root _want _have
