import { strict as assert } from 'node:assert';

import { FIXTURE_MONTH_SUMMARY } from '../src/reports/month-summary-fixture';
import {
  paceChartLayout,
  paceChartPlotBounds,
  paceDayAtX,
  pacePath,
} from '../src/ui/month-summary/pace-chart-layout';

test('projects actual points and the reference as a staircase', () => {
  const layout = paceChartLayout(FIXTURE_MONTH_SUMMARY.history);

  assert.equal(layout.actual.length, 14);
  assert.equal(layout.reference.length, 59);
  assert.deepEqual(layout.actualEnd, layout.actual[13]);
  assert.deepEqual(layout.referenceEnd, layout.reference[58]);
  assert.equal(layout.actual[0]?.x, paceChartPlotBounds().left);
  assert.equal(layout.reference[0]?.y, layout.reference[1]?.y);
  assert.equal(layout.reference[1]?.x, layout.reference[2]?.x);
  assert.match(pacePath(layout.actual), /^M /);
});

test('maps scrub positions to clamped day numbers', () => {
  const { left, right } = paceChartPlotBounds();
  assert.equal(paceDayAtX(left, 14), 1);
  assert.equal(paceDayAtX((left + right) / 2, 14), 8);
  assert.equal(paceDayAtX(right, 14), 14);
  assert.equal(paceDayAtX(-100, 14), 1);
  assert.equal(paceDayAtX(999, 14), 14);
  assert.equal(paceDayAtX(50, 0), 0);
});
