/** Operations needed by the horizon editor after the migration gate. */
import type { MonthConfigData } from '../../data/month-config';

export type HorizonEditorData = Pick<
  MonthConfigData<'sync'>,
  'readMonthConfig' | 'updateHorizon'
>;
