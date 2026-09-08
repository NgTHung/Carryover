/**
 * Stage 0 signing and widget probe.
 *
 * The same screen renders in a browser for fast layout work, but its notice
 * makes clear that only an installed iOS build can exercise native behavior.
 */
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FIXTURE_SNAPSHOT, formatVnd } from '../../budget/snapshot';
import { CrossFade } from '../../ui/CrossFade';
import { Button } from '../../ui/Button';
import { pushFixtureToWidget, readSigningFacts } from './runtime-diagnostics';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <CrossFade stateKey={value}>
        <Text style={styles.rowValue} selectable>
          {value.length ? value : '(empty)'}
        </Text>
      </CrossFade>
    </View>
  );
}

export function StageZeroScreen({ previewNotice }: { previewNotice?: string }) {
  const facts = useMemo(readSigningFacts, []);
  const [push, setPush] = useState<string>('Not run.');

  const pushToWidget = async () => {
    try {
      const result = await pushFixtureToWidget();
      setPush(
        result.status === 'pushed'
          ? `Wrote ₫12k and read back ${result.timelineEntries} entry(s). Check the widget.`
          : result.reason
      );
    } catch (error) {
      setPush(error instanceof Error ? error.message : String(error));
    }
  };

  if (typeof facts === 'string') {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>CARRYOVER · STAGE 0</Text>
          <Text style={styles.title}>Signing facts unavailable</Text>
          {previewNotice ? <Text style={styles.previewNotice}>{previewNotice}</Text> : null}
          <Text style={styles.error} selectable>
            {facts}
          </Text>
        </ScrollView>
      </View>
    );
  }

  const groupWorks = facts.grantedAppGroupsResolving.length > 0 || facts.containerPath !== '(nil)';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>CARRYOVER · STAGE 0</Text>
        <Text style={styles.title}>Signing facts</Text>
        {previewNotice ? <Text style={styles.previewNotice}>{previewNotice}</Text> : null}

        <Text style={styles.section}>IDENTITY</Text>
        <Row label="Bundle identifier" value={facts.bundleIdentifier} />
        <Row label="Team identifier" value={facts.teamIdentifier} />
        <Row label="Profile name" value={facts.profileName} />
        <Row
          label="Embedded profile"
          value={facts.profileFound ? 'found' : 'NOT FOUND (entitlements unreadable)'}
        />

        <Text style={styles.section}>APP GROUP</Text>
        <Row label="Configured (Info.plist)" value={facts.configuredAppGroup} />
        <Row label="Granted (profile)" value={facts.grantedAppGroups.join('\n') || '(none)'} />
        <Row
          label="Granted and resolving"
          value={facts.grantedAppGroupsResolving.join('\n') || '(none)'}
        />
        <Row label="Resolved in use" value={facts.resolvedAppGroup} />
        <Row label="Container path" value={facts.containerPath} />

        <View style={[styles.verdict, groupWorks ? styles.verdictOk : styles.verdictBad]}>
          <Text style={styles.verdictText}>
            {groupWorks
              ? 'A container resolved. The extension can read the shared store.'
              : 'No container resolved. The extension cannot receive a layout.'}
          </Text>
        </View>

        <Text style={styles.section}>ENTITLEMENTS ({facts.entitlementKeys.length})</Text>
        {facts.entitlementKeys.length === 0 ? (
          <Text style={styles.rowValue} selectable>
            (none readable)
          </Text>
        ) : (
          facts.entitlementKeys.map((key) => (
            <Row key={key} label={key} value={facts.entitlements[key] ?? '(nil)'} />
          ))
        )}

        <Text style={styles.section}>WIDGET</Text>
        <Text style={styles.note}>
          {`Fixture is ${formatVnd(FIXTURE_SNAPSHOT.perDay)}. Pushing writes ₫12k, so a widget that changes is reading this app's store.`}
        </Text>
        <Button onPress={pushToWidget}>Push ₫12k to widget</Button>
        <Row label="Push result" value={push} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1614' },
  content: { padding: 20, paddingTop: 68, paddingBottom: 60, gap: 8 },
  eyebrow: { color: '#46C4A4', fontSize: 11, letterSpacing: 1.6, fontWeight: '600' },
  title: { color: '#E4EAE7', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  previewNotice: {
    color: '#97AAA5',
    backgroundColor: '#14211E',
    borderColor: '#253430',
    borderWidth: 1,
    borderRadius: 6,
    padding: 11,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  section: {
    color: '#46C4A4',
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 2,
  },
  row: {
    backgroundColor: '#14211E',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#253430',
    padding: 11,
    gap: 3,
  },
  rowLabel: { color: '#6E827D', fontSize: 11, fontWeight: '600' },
  rowValue: {
    color: '#E4EAE7',
    fontSize: 13,
    fontFamily: 'Menlo',
    lineHeight: 18,
  },
  verdict: { borderRadius: 6, padding: 12, borderWidth: 1, marginTop: 8 },
  verdictOk: { backgroundColor: '#163029', borderColor: '#2C5B4E' },
  verdictBad: { backgroundColor: '#2C1D14', borderColor: '#6B3B22' },
  verdictText: { color: '#E4EAE7', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  note: { color: '#97AAA5', fontSize: 13, lineHeight: 19 },
  error: { color: '#E08A58', fontSize: 13, fontFamily: 'Menlo', lineHeight: 19 },
});
