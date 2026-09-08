/**
 * Shows why the app has not mounted its routes yet.
 *
 * Native routes stay behind migration completion so no screen can read a
 * partially upgraded ledger.
 */
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export function MigrationStatus({ message }: { message: string }) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>CARRYOVER · LEDGER</Text>
        <Text style={styles.title}>Preparing your ledger</Text>
        <Text style={styles.error} selectable>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1614' },
  content: { flex: 1, justifyContent: 'center', padding: 20, gap: 8 },
  eyebrow: { color: '#46C4A4', fontSize: 11, letterSpacing: 1.6, fontWeight: '600' },
  title: { color: '#E4EAE7', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  error: { color: '#E08A58', fontSize: 13, fontFamily: 'Menlo', lineHeight: 19 },
});
