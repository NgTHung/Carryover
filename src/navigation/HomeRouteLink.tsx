/**
 * Gives standalone routes a reliable path home.
 *
 * A cold-start deep link may have no navigation history, so this action uses
 * the home route instead of assuming a back action is available.
 */
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

export function HomeRouteLink() {
  return (
    <Link href="/" replace asChild>
      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Back to home</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#46C4A4',
    borderRadius: 8,
    marginTop: 12,
    padding: 14,
  },
  buttonText: { color: '#08120F', fontSize: 15, fontWeight: '700' },
});
