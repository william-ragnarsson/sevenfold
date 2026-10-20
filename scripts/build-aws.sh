#!/bin/sh
# Builds the Lambda bundles in .open-next/ (see open-next.config.ts and infra/).
#
# next.config.ts traces onnxruntime's linux x64 and arm64 binaries, because
# Vercel runs x64. The Lambda runs arm64, so the x64 library (37MB) and the
# local machine's binary are dead weight that push the zipped server bundle
# past Lambda's 50MB direct-upload limit. Drop them after the build.
set -eu

npx open-next build

ORT=.open-next/server-functions/default/node_modules/onnxruntime-node/bin/napi-v6
find "$ORT" -mindepth 2 -maxdepth 2 -type d ! -path "$ORT/linux/arm64" -exec rm -rf {} +
test -f "$ORT/linux/arm64/libonnxruntime.so.1" || { echo "onnxruntime linux-arm64 binary missing from the bundle" >&2; exit 1; }
