/**
 * Stage 0 spike screen.
 *
 * This is not the Carryover home screen. It exists to answer two questions from
 * a sideloaded build, and it reports the answers on device because there is no
 * simulator and no console to read.
 */
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CarryoverWidget } from './widgets/CarryoverWidget';
import { FIXTURE_SNAPSHOT, formatVnd } from './src/budget/snapshot';

type PushState =
  | { kind: 'idle' }
  | { kind: 'pushed'; perDay: number }
  | { kind: 'failed'; message: string };

export default function App() {
  const [push, setPush] = useState<PushState>({ kind: 'idle' });

  // A value the widget cannot already be showing, so a changed widget proves the
  // App Group data path rather than a cached render.
  const pushLiveNumbers = () => {
    const perDay = 10_000 + Math.floor(Math.random() * 90_000);
    try {
      CarryoverWidget.updateSnapshot({
        perDay,
        runwayDays: 7,
        unloggedDrafts: 0,
      });
      CarryoverWidget.reload();
      setPush({ kind: 'pushed', perDay });
    } catch (error) {
      setPush({
        kind: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>CARRYOVER · STAGE 0 SPIKE</Text>
        <Text style={styles.title}>Widget install test</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Fixture snapshot</Text>
          <Text style={styles.big}>{formatVnd(FIXTURE_SNAPSHOT.perDay)}</Text>
          <Text style={styles.sub}>
            {`${FIXTURE_SNAPSHOT.runwayDays}d runway · ${FIXTURE_SNAPSHOT.unloggedDrafts} unlogged`}
          </Text>
        </View>

        <Text style={styles.step}>
          1. The app runs if you can read this. Note the build you installed.
        </Text>
        <Text style={styles.step}>
          2. Long press the home screen, add the Carryover widget. If it appears
          in the gallery and shows {formatVnd(FIXTURE_SNAPSHOT.perDay)}, a
          sideloaded IPA carries a widget extension.
        </Text>
        <Text style={styles.step}>
          3. Tap below, then look at the widget again. A changed number means the
          App Group data path works on this signing setup.
        </Text>

        <Pressable style={styles.button} onPress={pushLiveNumbers}>
          <Text style={styles.buttonText}>Push new numbers to widget</Text>
        </Pressable>

        {push.kind === 'pushed' ? (
          <View style={[styles.result, styles.resultOk]}>
            <Text style={styles.resultTitle}>Pushed without error</Text>
            <Text style={styles.resultBody}>
              {`Widget should now read ${formatVnd(push.perDay)}. If it still shows the fixture, the call succeeded but the data never crossed.`}
            </Text>
          </View>
        ) : null}

        {push.kind === 'failed' ? (
          <View style={[styles.result, styles.resultBad]}>
            <Text style={styles.resultTitle}>Push failed</Text>
            <Text style={styles.resultBody}>{push.message}</Text>
            <Text style={styles.resultBody}>
              Record this text in docs/build/widget-sideload-result.md.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1614' },
  content: { padding: 24, paddingTop: 72, gap: 14 },
  eyebrow: { color: '#46C4A4', fontSize: 11, letterSpacing: 1.6, fontWeight: '600' },
  title: { color: '#E4EAE7', fontSize: 30, fontWeight: '700', marginBottom: 6 },
  card: {
    backgroundColor: '#14211E',
    borderRadius: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: '#253430',
    gap: 4,
  },
  cardLabel: { color: '#6E827D', fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  big: { color: '#E4EAE7', fontSize: 38, fontWeight: '700' },
  sub: { color: '#97AAA5', fontSize: 14 },
  step: { color: '#97AAA5', fontSize: 15, lineHeight: 22 },
  button: {
    backgroundColor: '#46C4A4',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: { color: '#08120F', fontSize: 16, fontWeight: '700' },
  result: { borderRadius: 8, padding: 15, gap: 6, borderWidth: 1 },
  resultOk: { backgroundColor: '#163029', borderColor: '#2C5B4E' },
  resultBad: { backgroundColor: '#2C1D14', borderColor: '#6B3B22' },
  resultTitle: { color: '#E4EAE7', fontSize: 15, fontWeight: '700' },
  resultBody: { color: '#B9C7C3', fontSize: 13, lineHeight: 19 },
});
