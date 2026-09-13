#!/usr/bin/env bash
# Report a failed build too, so the next investigation has compiler evidence.
set -euo pipefail

mkdir -p "$BUILD_REPORT_DIR"
ccache --show-stats --verbose | tee "$BUILD_REPORT_DIR/ccache.txt"
{
  echo '### Native build performance'
  echo '```text'
  if [[ -f "$BUILD_REPORT_DIR/xcodebuild.log" ]] &&
    grep -q 'Build Timing Summary' "$BUILD_REPORT_DIR/xcodebuild.log"; then
    awk '/Build Timing Summary/ { printing = 1 } printing' "$BUILD_REPORT_DIR/xcodebuild.log"
  else
    echo 'Xcode did not emit a timing summary. See the build log for the failure.'
  fi
  echo '```'
  echo '### Compiler cache'
  echo '```text'
  cat "$BUILD_REPORT_DIR/ccache.txt"
  echo '```'
} | tee -a "$GITHUB_STEP_SUMMARY"
