"""Exercise build diagnostics without requiring a Mac or running a compiler."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class IosBuildTests(unittest.TestCase):
    def test_compiler_failure_survives_logging_and_reports_cache_statistics(self):
        for exit_code, timing in ((0, True), (65, True), (65, False)):
            with self.subTest(exit_code=exit_code, timing=timing), tempfile.TemporaryDirectory() as directory:
                work = Path(directory)
                (work / 'ios' / 'Carryover.xcworkspace').mkdir(parents=True)
                binaries = work / 'bin'
                binaries.mkdir()
                commands = {
                    'xcrun': 'echo "/usr/bin/$2"\n',
                    'xcodebuild': (
                        'printf "%s\\n" "$@" > "$BUILD_ARGS"\n'
                        'echo "compiler diagnostic" >&2\n'
                        + ('echo "Build Timing Summary"\necho "CompileC 2.0 seconds"\n' if timing else '')
                        + f'exit {exit_code}\n'
                    ),
                    'ccache': (
                        f'echo "$*" >> "{work}/cache-args"\n'
                        'if [ "$1" = "/usr/bin/clang" ] || [ "$1" = "/usr/bin/clang++" ]; then\n'
                        f'  printf "%s\\n" "$CCACHE_DIR" "$CCACHE_CONFIGPATH" "$CCACHE_BASEDIR" > "{work}/compiler-env"\n'
                        'fi\n'
                        'if [ "$1" = "--show-stats" ]; then echo "Hits: 10"; fi\n'
                    ),
                }
                for name, content in commands.items():
                    executable = binaries / name
                    executable.write_text('#!/bin/sh\n' + content)
                    executable.chmod(0o755)
                env = {
                    **os.environ,
                    'PATH': f'{binaries}{os.pathsep}{os.environ["PATH"]}',
                    'BUILD_REPORT_DIR': str(work / 'reports'),
                    'BUILD_CONFIGURATION': 'Release',
                    'GITHUB_STEP_SUMMARY': str(work / 'summary.md'),
                    'BUILD_ARGS': str(work / 'build-args'),
                    'CACHE_ARGS': str(work / 'cache-args'),
                    'CCACHE_DIR': str(work / 'cache with spaces'),
                    'CCACHE_BASEDIR': str(work),
                    'CCACHE_MAXSIZE': '1G',
                    'CCACHE_COMPILERCHECK': 'content',
                }
                build = subprocess.run(
                    ['bash', str(ROOT / 'scripts/build-ios.sh')],
                    cwd=work, env=env, capture_output=True, text=True,
                )
                self.assertEqual(build.returncode, exit_code, build.stderr)
                arguments = (work / 'build-args').read_text().splitlines()
                for required in ['-showBuildTimingSummary', 'generic/platform=iOS',
                                 'CODE_SIGNING_ALLOWED=NO', 'Release']:
                    self.assertIn(required, arguments)
                report = subprocess.run(
                    ['bash', str(ROOT / 'scripts/report-ios-build.sh')],
                    cwd=work, env=env, capture_output=True, text=True,
                )
                self.assertEqual(report.returncode, 0, report.stderr)
                summary = (work / 'summary.md').read_text()
                self.assertIn('CompileC 2.0 seconds' if timing else 'Xcode did not emit a timing summary', summary)
                self.assertIn('Hits: 10', summary)
                self.assertIn('compiler diagnostic', (work / 'reports/xcodebuild.log').read_text())
                self.assertEqual((work / 'cache-args').read_text().splitlines(),
                                 ['--zero-stats', '--show-stats --verbose'])
                for compiler in ('clang', 'clang++'):
                    self.assertIn(f'{"CC" if compiler == "clang" else "CXX"}={work}/reports/{compiler}', arguments)
                    subprocess.run([str(work / 'reports' / compiler), '-c', 'source with spaces.m'],
                                   env={}, check=True)
                    self.assertEqual((work / 'compiler-env').read_text().splitlines(), [
                        env['CCACHE_DIR'], str(work / 'node_modules/react-native/scripts/xcode/ccache.conf'),
                        str(work),
                    ])


if __name__ == '__main__':
    unittest.main()
