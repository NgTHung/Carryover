#!/usr/bin/env bash
# Keep the compiler failure visible even when tee successfully saves the log.
set -euo pipefail

mkdir -p "$BUILD_REPORT_DIR"
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
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build 2>&1 | tee "$BUILD_REPORT_DIR/xcodebuild.log"
