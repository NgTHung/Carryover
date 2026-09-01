/**
 * The home screen widget.
 *
 * It renders whatever props the app last pushed with `updateSnapshot`. Props
 * fall back to the fixture so the widget still draws before any push happens,
 * which is what separates the two questions in the build:WIDGET-001 spike:
 * fixture text on screen means the extension installed, live numbers mean the
 * App Group data path also works.
 */
import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { FIXTURE_SNAPSHOT, formatVndCompact } from '../src/budget/snapshot';

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
    <VStack spacing={2}>
      <Text
        modifiers={[
          font({ size: 11, weight: 'medium' }),
          foregroundStyle('secondary'),
        ]}
      >
        TODAY
      </Text>
      <Text modifiers={[font({ size: 30, weight: 'bold' })]}>
        {formatVndCompact(perDay)}
      </Text>
      <Text
        modifiers={[font({ size: 12 }), foregroundStyle('secondary')]}
      >
        {`${runwayDays}d runway`}
      </Text>
      {unloggedDrafts > 0 ? (
        <Text
          modifiers={[
            font({ size: 12, weight: 'semibold' }),
            foregroundStyle('orange'),
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
