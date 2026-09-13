"""Exercise IPA metadata and publication failures without uploading releases."""

import importlib.util
import json
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("source", ROOT / "scripts/sideload-source.py")
SOURCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SOURCE)


class SourceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.ipa = self.root / "carryover.ipa"
        self.native = self.root / "ios"
        self.native.mkdir()
        (self.native / "app.entitlements").write_bytes(plistlib.dumps({
            "com.apple.security.application-groups": ["group.com.bbq.carryover.dev"],
        }))
        self.info = {
            "CFBundleIdentifier": "com.bbq.carryover.dev",
            "CFBundleName": "CarryoverDev",
            "CFBundleDisplayName": "Carryover Dev",
            "CFBundleShortVersionString": "0.1.0",
            "CFBundleVersion": "42.2",
            "MinimumOSVersion": "16.4",
            "NSCameraUsageDescription": "Capture a purchase.",
        }

    def source(self, channel="development", widget=False):
        with ZipFile(self.ipa, "w") as archive:
            archive.writestr("Payload/Carryover.app/Info.plist", plistlib.dumps(self.info, fmt=plistlib.FMT_BINARY))
            if widget:
                archive.writestr("Payload/Carryover.app/PlugIns/Widget.appex/Info.plist", b"")
        return SOURCE.make_source(self.ipa, self.native, "NgTHung/Carryover", channel, "42.2")

    def test_metadata_matches_binary_and_legacy_clients(self):
        source = self.source()
        app = source["apps"][0]
        version = app["versions"][0]
        self.assertEqual(app["name"], "Carryover Dev")
        self.assertEqual(version["size"], self.ipa.stat().st_size)
        self.assertEqual(version["minOSVersion"], "16.4")
        self.assertEqual(version["buildVersion"], "42.2")
        self.assertEqual(version["version"], "0.1.0")
        self.assertEqual(app["downloadURL"], version["downloadURL"])
        self.assertTrue(app["downloadURL"].endswith("/ios-development/carryover-42.2.ipa"))
        self.assertEqual(app["appPermissions"]["privacy"], {"NSCameraUsageDescription": "Capture a purchase."})
        self.assertEqual(app["appPermissions"]["entitlements"], ["com.apple.security.application-groups"])

    def test_release_has_its_own_source_and_identity(self):
        self.info["CFBundleIdentifier"] = "com.bbq.carryover"
        app = self.source("release")["apps"][0]
        self.assertIn("/ios-release/", app["downloadURL"])
        self.assertEqual(app["bundleIdentifier"], "com.bbq.carryover")

    def test_wrong_channel_build_and_widget_fail(self):
        with self.assertRaisesRegex(ValueError, "identity"):
            self.source("release")
        with self.assertRaisesRegex(ValueError, "Widget"):
            self.source(widget=True)
        self.info["CFBundleVersion"] = "1"
        with self.assertRaisesRegex(ValueError, "build number"):
            self.source()

    def test_missing_entitlements_fail(self):
        (self.native / "app.entitlements").unlink()
        with self.assertRaisesRegex(ValueError, "entitlement"):
            self.source()

    def publish(self, current="", failure="", existing=""):
        source = self.source()
        (self.root / "sideload").mkdir()
        (self.root / "sideload/source.json").write_text(json.dumps(source))
        (self.root / "sideload/carryover-42.2.png").write_bytes(b"icon")
        fake = self.root / "gh"
        fake.write_text('''#!/usr/bin/env python3
import json, os, pathlib, sys
a = sys.argv[1:]
with open('calls.jsonl', 'a') as log:
    log.write(json.dumps(a) + '\\n')
if os.environ['FAILURE'] and os.environ['FAILURE'] in ' '.join(a):
    sys.exit(1)
if a[0] == 'api' and os.environ['CURRENT']:
    print('ios-development')
if a[:2] == ['release', 'view'] and os.environ['CURRENT']:
    print('source.json')
if a[:2] == ['release', 'view'] and os.environ['EXISTING']:
    print(os.environ['EXISTING'])
if a[:2] == ['release', 'download']:
    pathlib.Path(a[-1], 'source.json').write_text(json.dumps({
        'apps': [{'versions': [{'buildVersion': os.environ['CURRENT']}]}]}))
''')
        fake.chmod(0o755)
        result = subprocess.run(["bash", str(ROOT / "scripts/publish-sideload.sh")], cwd=self.root,
                                env={**os.environ, "PATH": f"{self.root}:{os.environ['PATH']}",
                                     "GH_REPO": "NgTHung/Carryover", "CARRYOVER_VARIANT": "development",
                                     "CARRYOVER_BUILD_NUMBER": "42.3",
                                     "GITHUB_SHA": "abc123", "GITHUB_STEP_SUMMARY": str(self.root / "summary"),
                                     "CURRENT": current, "FAILURE": failure, "EXISTING": existing}, capture_output=True, text=True)
        calls = [json.loads(line) for line in (self.root / "calls.jsonl").read_text().splitlines()]
        return result, [call for call in calls if call[:2] == ["release", "upload"]]

    def test_uploads_binary_and_icon_before_source(self):
        result, uploads = self.publish()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([u[3] for u in uploads], [
            "sideload/carryover-42.2.ipa", "sideload/carryover-42.2.png", "sideload/source.json"])
        self.assertEqual(uploads[-1][-1], "--clobber")

    def test_failed_ipa_upload_does_not_replace_source(self):
        result, uploads = self.publish(failure=".ipa")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(uploads), 1)

    def test_older_retry_does_not_downgrade_source(self):
        result, uploads = self.publish(current="100.1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(uploads, [])

    def test_api_failure_does_not_create_or_upload(self):
        result, uploads = self.publish(failure="api")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(uploads, [])

    def test_retry_reuses_original_build_assets(self):
        result, uploads = self.publish(current="41.1", existing="carryover-42.2.ipa\ncarryover-42.2.png")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([u[3] for u in uploads], ["sideload/source.json"])

    def test_corrupt_current_source_fails_without_uploading(self):
        result, uploads = self.publish(current="invalid")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(uploads, [])
