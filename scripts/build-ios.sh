#!/usr/bin/env bash
# Keep the compiler failure visible even when tee successfully saves the log.
set -euo pipefail

mkdir -p "$BUILD_REPORT_DIR"
# Xcode's compiler subprocesses do not reliably inherit the workflow's cache
# environment. Bake the paths into wrappers that also work with an empty env.
CCACHE_BINARY="$(command -v ccache)"
export CCACHE_CONFIGPATH="$PWD/node_modules/react-native/scripts/xcode/ccache.conf"
CLANG="$(xcrun --find clang)"
CLANGPLUSPLUS="$(xcrun --find clang++)"
for compiler in clang clang++; do
  compiler_path="$CLANG"
  if [[ "$compiler" == clang++ ]]; then compiler_path="$CLANGPLUSPLUS"; fi
  wrapper="$BUILD_REPORT_DIR/$compiler"
  {
    echo '#!/bin/bash'
    echo 'set -euo pipefail'
    for variable in CCACHE_DIR CCACHE_BASEDIR CCACHE_MAXSIZE CCACHE_COMPILERCHECK CCACHE_CONFIGPATH; do
      printf 'export %s=%q\n' "$variable" "${!variable}"
    done
    printf 'exec %q %q "$@"\n' "$CCACHE_BINARY" "$compiler_path"
  } > "$wrapper"
  chmod +x "$wrapper"
done
ccache --zero-stats
cd ios
SCHEME="$(basename ./*.xcworkspace .xcworkspace)"
echo "Building scheme: $SCHEME"
xcodebuild \
  -workspace "$SCHEME.xcworkspace" \
  -scheme "$SCHEME" \
  -configuration "$BUILD_CONFIGURATION" \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build \
  -showBuildTimingSummary \
  CC="$BUILD_REPORT_DIR/clang" \
  CXX="$BUILD_REPORT_DIR/clang++" \
  LD="$CLANG" \
  LDPLUSPLUS="$CLANGPLUSPLUS" \
  CLANG_ENABLE_EXPLICIT_MODULES=NO \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build 2>&1 | tee "$BUILD_REPORT_DIR/xcodebuild.log"
