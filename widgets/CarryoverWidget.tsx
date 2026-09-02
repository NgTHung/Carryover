/**
 * The home screen widget.
 *
 * It renders whatever props the app last pushed with `updateSnapshot`. Props
 * fall back to the fixture so the widget still draws before any push happens,
 * which is what separates the two questions in the build:WIDGET-001 spike:
 * fixture text on screen means the extension installed, live numbers mean the
 * App Group data path also works.
 *
 * The widget commits to one dark look rather than adapting to the system theme.
 * WidgetKit needs an explicit container background, and a single ground lets
 * every foreground colour be stated once instead of resolving per theme.
 */
import { Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { FIXTURE_SNAPSHOT, formatVndCompact } from '../src/budget/snapshot';

const GROUND = '#0D1614';
const INK = '#E4EAE7';
const MUTED = '#97AAA5';
const ALERT = '#E08A58';

export type CarryoverWidgetProps = {
  perDay?: number;
  runwayDays?: number;
  unloggedDrafts?: number;
};

const CarryoverWidgetView = (
  props: CarryoverWidgetProps,
  _environment: WidgetEnvironment
) => {
  'widget';

  const perDay = props?.perDay ?? FIXTURE_SNAPSHOT.perDay;
  const runwayDays = props?.runwayDays ?? FIXTURE_SNAPSHOT.runwayDays;
  const unloggedDrafts = props?.unloggedDrafts ?? FIXTURE_SNAPSHOT.unloggedDrafts;

  return (
    <VStack
      spacing={2}
      // iOS 17 and later refuse to draw a widget that has not adopted this API,
      // showing "Please adopt containerBackground API" in place of the content.
      modifiers={[containerBackground(GROUND, 'widget')]}
    >
      <Text
        modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(MUTED)]}
      >
        TODAY
      </Text>
      <Text
        modifiers={[font({ size: 30, weight: 'bold' }), foregroundStyle(INK)]}
      >
        {formatVndCompact(perDay)}
      </Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>
        {`${runwayDays}d runway`}
      </Text>
      {unloggedDrafts > 0 ? (
        <Text
          modifiers={[
            font({ size: 12, weight: 'semibold' }),
            foregroundStyle(ALERT),
          ]}
        >
          {`${unloggedDrafts} unlogged`}
        </Text>
      ) : null}
    </VStack>
  );
};

export const CarryoverWidget = createWidget('CarryoverWidget', CarryoverWidgetView);

export default CarryoverWidget;
