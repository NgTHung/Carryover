/**
 * Gives standalone routes a reliable path home.
 *
 * A cold-start deep link may have no navigation history, so this action uses
 * the home route instead of assuming a back action is available.
 */
import { Link } from 'expo-router';

import { Button } from './Button';

export function HomeRouteLink() {
  return (
    <Link href="/" replace asChild>
      <Button className="mt-3">Back to home</Button>
    </Link>
  );
}
