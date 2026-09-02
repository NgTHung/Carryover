/**
 * Stage 0 spike screen.
 *
 * This is not the Carryover home screen. It answers whether a sideloaded build
 * can drive a home screen widget, and it reports on device because there is no
 * simulator and no console to read.
 *
 * The widget's layout crosses to the extension through the App Group container,
 * so an App Group that is not provisioned looks identical to a widget bug: the
 * extension renders nothing and WidgetKit complains about a missing container
 * background. These checks tell the two apart.
 */
import { StatusBar } from 'expo-status-bar';
import { widgetsDirectory } from 'expo-widgets';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CarryoverWidget } from './widgets/CarryoverWidget';
import { FIXTURE_SNAPSHOT, formatVnd } from './src/budget/snapshot';

type CheckStatus = 'pending' | 'pass' | 'fail';

type Check = {
  name: string;
  status: CheckStatus;
  detail: string;
};

const INITIAL_CHECKS: Check[] = [
  { name: 'App Group container', status: 'pending', detail: 'Not run.' },
  { name: 'Timeline write and read back', status: 'pending', detail: 'Not run.' },
];

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value.length ? value : '(empty string)';
  return JSON.stringify(value);
}

export default function App() {
  const [checks, setChecks] = useState<Check[]>(INITIAL_CHECKS);
  const [ran, setRan] = useState(false);

  const runDiagnostics = async () => {
    const results: Check[] = [];

    // The container path is the App Group itself. A path that does not name the
    // group means the entitlement did not survive signing.
    try {
      const dir = widgetsDirectory as unknown;
      const dirText = describe(dir);
      const looksReal =
        typeof dir === 'string' &&
        dir.length > 0 &&
        dir.includes('group.com.bbq.carryover');
      results.push({
        name: 'App Group container',
        status: looksReal ? 'pass' : 'fail',
        detail: dirText,
      });
    } catch (error) {
      results.push({
        name: 'App Group container',
        status: 'fail',
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    // updateSnapshot writes through the App Group and getTimeline reads back
    // over the same channel the extension uses. A successful round trip proves
    // the app side of the group works.
    const probe = 12_345;
    try {
      CarryoverWidget.updateSnapshot({
        perDay: probe,
        runwayDays: 7,
        unloggedDrafts: 0,
      });
      const timeline = await CarryoverWidget.getTimeline();
      const found = timeline.some(
        (entry) => (entry.props as { perDay?: number })?.perDay === probe
      );
      results.push({
        name: 'Timeline write and read back',
        status: found ? 'pass' : 'fail',
        detail: found
          ? `Read back ${timeline.length} entry(s) including the probe.`
          : `Wrote ${probe} but read back ${timeline.length} entry(s) without it: ${JSON.stringify(timeline).slice(0, 200)}`,
      });
      CarryoverWidget.reload();
    } catch (error) {
      results.push({
        name: 'Timeline write and read back',
        status: 'fail',
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    setChecks(results);
    setRan(true);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>CARRYOVER · STAGE 0 SPIKE</Text>
        <Text style={styles.title}>App Group diagnostics</Text>

        <Text style={styles.step}>
          The widget cannot compute anything. Its layout is handed to the
          extension through the App Group, so if the group is dead the widget
          renders nothing and WidgetKit blames the container background. These
          checks separate the two.
        </Text>

        <Pressable style={styles.button} onPress={runDiagnostics}>
          <Text style={styles.buttonText}>Run diagnostics</Text>
        </Pressable>

        {checks.map((check) => (
          <View
            key={check.name}
            style={[
              styles.check,
              check.status === 'pass' && styles.checkPass,
              check.status === 'fail' && styles.checkFail,
            ]}
          >
            <Text style={styles.checkName}>
              {check.status === 'pass' ? 'PASS' : check.status === 'fail' ? 'FAIL' : '—'}
              {'  '}
              {check.name}
            </Text>
            <Text style={styles.checkDetail} selectable>
              {check.detail}
            </Text>
          </View>
        ))}

        {ran ? (
          <Text style={styles.step}>
            Both pass: the App Group works and the widget should render. Check
            the home screen now, it was told to reload.
            {'\n\n'}
            Both fail: the App Group is not provisioned on this signing setup,
            which is the answer the spike was after.
            {'\n\n'}
            Container passes but the timeline fails: the group exists and the
            fault is in expo-widgets.
          </Text>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Widget should show</Text>
          <Text style={styles.big}>{formatVnd(FIXTURE_SNAPSHOT.perDay)}</Text>
          <Text style={styles.sub}>
            {`${FIXTURE_SNAPSHOT.runwayDays}d runway · ${FIXTURE_SNAPSHOT.unloggedDrafts} unlogged`}
          </Text>
          <Text style={styles.sub}>
            After a successful run it should read ₫12k instead.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1614' },
  content: { padding: 24, paddingTop: 72, gap: 14 },
  eyebrow: { color: '#46C4A4', fontSize: 11, letterSpacing: 1.6, fontWeight: '600' },
  title: { color: '#E4EAE7', fontSize: 30, fontWeight: '700', marginBottom: 6 },
  step: { color: '#97AAA5', fontSize: 15, lineHeight: 22 },
  button: {
    backgroundColor: '#46C4A4',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginVertical: 4,
  },
  buttonText: { color: '#08120F', fontSize: 16, fontWeight: '700' },
  check: {
    borderRadius: 8,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    backgroundColor: '#14211E',
    borderColor: '#253430',
  },
  checkPass: { backgroundColor: '#163029', borderColor: '#2C5B4E' },
  checkFail: { backgroundColor: '#2C1D14', borderColor: '#6B3B22' },
  checkName: { color: '#E4EAE7', fontSize: 14, fontWeight: '700' },
  checkDetail: { color: '#B9C7C3', fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: '#14211E',
    borderRadius: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: '#253430',
    gap: 4,
    marginTop: 6,
  },
  cardLabel: { color: '#6E827D', fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  big: { color: '#E4EAE7', fontSize: 34, fontWeight: '700' },
  sub: { color: '#97AAA5', fontSize: 13 },
});
