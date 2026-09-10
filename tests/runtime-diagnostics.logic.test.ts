const mockRefreshBudgetSnapshot = jest.fn();
const mockGetTimeline = jest.fn();
const mockUpdateSnapshot = jest.fn();

jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(),
}));

jest.mock('../src/ui/ledger-access', () => ({
  refreshBudgetSnapshot: () => mockRefreshBudgetSnapshot(),
}));

jest.mock('../widgets/CarryoverWidget', () => ({
  CarryoverWidget: {
    getTimeline: () => mockGetTimeline(),
    updateSnapshot: (...args: unknown[]) => mockUpdateSnapshot(...args),
  },
}));

import { publishCurrentSnapshotToWidget } from '../src/ui/diagnostics/runtime-diagnostics';

beforeEach(() => {
  jest.clearAllMocks();
  mockRefreshBudgetSnapshot.mockResolvedValue(undefined);
  mockGetTimeline.mockResolvedValue([{ date: new Date(), props: {} }]);
});

test('the widget diagnostic republishes committed data through the snapshot service', async () => {
  await expect(publishCurrentSnapshotToWidget()).resolves.toEqual({
    status: 'pushed',
    timelineEntries: 1,
  });

  expect(mockRefreshBudgetSnapshot).toHaveBeenCalledTimes(1);
  expect(mockGetTimeline).toHaveBeenCalledTimes(1);
  expect(mockRefreshBudgetSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
    mockGetTimeline.mock.invocationCallOrder[0]
  );
  expect(mockUpdateSnapshot).not.toHaveBeenCalled();
});
