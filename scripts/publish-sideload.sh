#!/usr/bin/env bash
# Upload immutable binaries before replacing the source so cached feeds stay valid.
set -euo pipefail

: "${GH_REPO:?}" "${CARRYOVER_VARIANT:?}" "${GITHUB_SHA:?}"
case "$CARRYOVER_VARIANT" in
  release|development) ;;
  *) echo 'Unknown distribution channel' >&2; exit 1 ;;
esac
tag="ios-$CARRYOVER_VARIANT"
# Retrying only publication reuses the successful build's original attempt.
build_number="$(jq -er '.apps[0].versions[0].buildVersion' sideload/source.json)"
asset="carryover-$build_number"
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT

# Distinguish an absent release from a failed authenticated request.
gh api "repos/$GH_REPO/releases?per_page=100" --paginate --jq '.[].tag_name' > "$temporary/tags"
if ! grep -Fxq "$tag" "$temporary/tags"; then
  cat > "$temporary/notes" <<EOF
Unsigned Carryover $CARRYOVER_VARIANT builds for your on-device signer.
Add https://github.com/$GH_REPO/releases/download/$tag/source.json as an AltStore source.
The source identifies the current build. The tag anchors this channel's first build.
Keep the same signing identity and bundle identifier when updating.
EOF
  gh release create "$tag" --target "$GITHUB_SHA" --prerelease --latest=false \
    --title "Carryover $CARRYOVER_VARIANT builds" --notes-file "$temporary/notes"
fi

gh release view "$tag" --json assets --jq '.assets[].name' > "$temporary/assets"
if grep -Fxq 'source.json' "$temporary/assets"; then
  gh release download "$tag" --pattern source.json --dir "$temporary"
  # An old run can be retried after a newer run has already published.
  newer="$(jq --slurpfile current "$temporary/source.json" '
    (.apps[0].versions[0].buildVersion | split(".") | map(tonumber)) >
    ($current[0].apps[0].versions[0].buildVersion | split(".") | map(tonumber))
  ' sideload/source.json)"
  if [ "$newer" != true ]; then
    echo 'This channel already has an equal or newer build.'
    exit 0
  fi
fi

cp carryover.ipa "sideload/$asset.ipa"
for file in "sideload/$asset.ipa" "sideload/$asset.png"; do
  if ! grep -Fxq "$(basename "$file")" "$temporary/assets"; then
    gh release upload "$tag" "$file"
  fi
done
gh release upload "$tag" sideload/source.json --clobber
echo "Source: https://github.com/$GH_REPO/releases/download/$tag/source.json" >> "$GITHUB_STEP_SUMMARY"
