"""Build a signer source from the IPA so displayed metadata matches the download.

Use only Python's standard library so macOS and Linux CI need no extra packages.
"""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import plistlib
import re
import shutil
from zipfile import ZipFile


def make_source(ipa, native, repository, channel, build_number):
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", repository):
        raise ValueError("Expected a GitHub owner/repository")
    if channel not in ("release", "development"):
        raise ValueError("Unknown distribution channel")
    if not re.fullmatch(r"[1-9]\d*\.[1-9]\d*", build_number):
        raise ValueError("Expected a workflow run number and attempt")

    with ZipFile(ipa) as archive:
        names = archive.namelist()
        plists = [n for n in names if re.fullmatch(r"Payload/[^/]+\.app/Info.plist", n)]
        if len(plists) != 1:
            raise ValueError("Expected exactly one application in the IPA")
        if any(".appex/" in n for n in names):
            raise ValueError("Widget experiments must not replace the normal source")
        info = plistlib.loads(archive.read(plists[0]))

    bundle_id = "com.bbq.carryover" + (".dev" if channel == "development" else "")
    if info["CFBundleIdentifier"] != bundle_id:
        raise ValueError("IPA identity does not match the distribution channel")
    if info["CFBundleVersion"] != build_number:
        raise ValueError("IPA build number does not match this workflow run")

    entitlements = set()
    for path in native.rglob("*.entitlements"):
        if not {"Pods", "build"}.intersection(path.relative_to(native).parts):
            entitlements.update(plistlib.loads(path.read_bytes()))
    if "com.apple.security.application-groups" not in entitlements:
        raise ValueError("Generated App Group entitlement is missing")

    website = f"https://github.com/{repository}"
    base = f"{website}/releases/download/ios-{channel}"
    asset = f"carryover-{build_number}"
    description = (
        "Development build for local Fast Refresh. Requires your Metro server."
        if channel == "development" else
        "Personal budgeting for irregular income. Sign and install on your iPhone."
    )
    version = {
        "version": info["CFBundleShortVersionString"],
        "buildVersion": build_number,
        "date": datetime.now(timezone.utc).isoformat(),
        "localizedDescription": f"{description} Build {build_number}.",
        "downloadURL": f"{base}/{asset}.ipa",
        "size": ipa.stat().st_size,
        "minOSVersion": info["MinimumOSVersion"],
    }
    app = {
        "name": info.get("CFBundleDisplayName", info["CFBundleName"]),
        "bundleIdentifier": bundle_id,
        "developerName": repository.split("/")[0],
        "localizedDescription": description,
        "iconURL": f"{base}/{asset}.png",
        "versions": [version],
        "appPermissions": {
            "entitlements": sorted(entitlements),
            "privacy": {k: v for k, v in info.items() if k.startswith("NS") and "UsageDescription" in k},
        },
        # Older signer clients read these fields instead of the versions array.
        **{k: version[k] for k in ("version", "buildVersion", "downloadURL", "size")},
        "versionDate": version["date"],
        "versionDescription": version["localizedDescription"],
    }
    return {
        "name": f"{app['name']} builds",
        "identifier": f"com.bbq.carryover.source.{channel}",
        "sourceURL": f"{base}/source.json",
        "website": website,
        "apps": [app],
        "news": [],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--channel", required=True)
    parser.add_argument("--build-number", required=True)
    parser.add_argument("--ipa", type=Path, default=Path("carryover.ipa"))
    parser.add_argument("--native", type=Path, default=Path("ios"))
    parser.add_argument("--output", type=Path, default=Path("sideload"))
    args = parser.parse_args()
    source = make_source(args.ipa, args.native, args.repository, args.channel, args.build_number)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "source.json").write_text(json.dumps(source, indent=2) + "\n")
    shutil.copyfile("assets/icon.png", args.output / f"carryover-{args.build_number}.png")
