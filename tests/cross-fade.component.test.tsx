import { act, cleanup, render, screen } from '@testing-library/react-native';
import { StrictMode, useEffect, useState } from 'react';
import { Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { CrossFade } from '../src/ui/CrossFade';
import { useMotionPlan } from '../src/ui/motion';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<typeof Reanimated>('react-native-reanimated'),
  withTiming: jest.fn(),
}));

jest.mock('../src/ui/motion', () => ({
  ...jest.requireActual<typeof import('../src/ui/motion')>('../src/ui/motion'),
  useMotionPlan: jest.fn(),
}));

type TimingArguments = Parameters<typeof Reanimated.withTiming>;
const animations: TimingArguments[] = [];
const mockedPlan = jest.mocked(useMotionPlan);

beforeEach(() => {
  animations.length = 0;
  mockedPlan.mockReturnValue({ kind: 'timing', duration: 200 });
  // Hold completion at the native boundary so cleanup cannot pass on elapsed time.
  jest.mocked(Reanimated.withTiming).mockImplementation((...args) => {
    animations.push(args);
    return args[0];
  });
});

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

function content(key: string, label = key) {
  return <CrossFade stateKey={key}><Text>{label}</Text></CrossFade>;
}

function outgoingAnimation() {
  const animation = animations.find(([target]) => target === 0);
  if (!animation?.[2]) throw new Error('Expected an outgoing animation callback');
  return animation[2];
}

test('overlaps both presentations and removes outgoing content only on completion', async () => {
  const view = await render(content('first'));
  expect(animations).toHaveLength(0);
  await view.rerender(content('second'));

  const outgoing = screen.getByText('first', { includeHiddenElements: true });
  expect(outgoing.parent?.props).toMatchObject({
    pointerEvents: 'none',
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  });
  expect(screen.queryByText('first')).toBeNull();
  expect(screen.getByText('second')).toBeTruthy();
  expect(animations.map(([target]) => target)).toEqual([0, 1]);

  const finish = outgoingAnimation();
  await act(async () => finish(false));
  expect(screen.getByText('first', { includeHiddenElements: true })).toBeTruthy();
  await act(async () => finish(true));
  expect(screen.queryByText('first', { includeHiddenElements: true })).toBeNull();
  expect(screen.getByText('second')).toBeTruthy();
});

test('same-key updates keep the subtree mounted and become the outgoing presentation', async () => {
  const mounted = jest.fn();
  function StatefulLabel({ label }: { label: string }) {
    const [identity] = useState('preserved');
    useEffect(() => { mounted(); }, []);
    return <Text>{label} {identity}</Text>;
  }
  const view = await render(
    <CrossFade stateKey="first"><StatefulLabel label="original" /></CrossFade>
  );
  await view.rerender(
    <CrossFade stateKey="first"><StatefulLabel label="updated" /></CrossFade>
  );
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(animations).toHaveLength(0);
  expect(screen.getByText('updated preserved')).toBeTruthy();
  await view.rerender(content('second'));
  expect(screen.getByText('updated preserved', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByText('original preserved', { includeHiddenElements: true })).toBeNull();
});

test('ordinary reduced motion replaces instantly and still accepts same-key updates', async () => {
  mockedPlan.mockReturnValue({ kind: 'instant', duration: 0 });
  const view = await render(content('first'));
  await view.rerender(content('second'));
  await view.rerender(content('second', 'updated'));
  expect(screen.queryByText('first', { includeHiddenElements: true })).toBeNull();
  expect(screen.getByText('updated')).toBeTruthy();
  expect(animations).toHaveLength(0);
});

test('the reduced-motion hero cross-fades opaque money text for 150ms', async () => {
  mockedPlan.mockReturnValue({ kind: 'crossFade', duration: 150 });
  const view = await render(
    <CrossFade stateKey="first" intent="heroRecount"><Text>₫45,001</Text></CrossFade>
  );
  await view.rerender(
    <CrossFade stateKey="second" intent="heroRecount"><Text>₫40,000</Text></CrossFade>
  );
  expect(mockedPlan).toHaveBeenLastCalledWith('heroRecount');
  expect(screen.getByText('₫45,001', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText('₫40,000')).toBeTruthy();
  expect(animations.map(([target, config]) => [target, config?.duration, config?.reduceMotion]))
    .toEqual([[0, 150, Reanimated.ReduceMotion.Never], [1, 150, Reanimated.ReduceMotion.Never]]);
});

test('late completion after rapid key reuse cannot remove the current presentation', async () => {
  const view = await render(content('first', 'old first'));
  await view.rerender(content('second'));
  const finishOld = outgoingAnimation();
  await view.rerender(content('first', 'new first'));
  expect(screen.getByText('old first', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText('second', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByText('second')).toBeNull();
  await act(async () => finishOld(true));
  expect(screen.getByText('new first')).toBeTruthy();
  expect(screen.queryByText('old first', { includeHiddenElements: true })).toBeNull();
  await act(async () => {
    for (const [target, , finish] of animations) if (target === 0) finish?.(true);
  });
  expect(screen.queryByText('second', { includeHiddenElements: true })).toBeNull();
  expect(screen.getByText('new first')).toBeTruthy();
});

test('switching to instant motion removes outgoing layers without a key change', async () => {
  const view = await render(content('first'));
  await view.rerender(content('second'));
  const finishOld = outgoingAnimation();
  mockedPlan.mockReturnValue({ kind: 'instant', duration: 0 });
  await view.rerender(content('second'));
  expect(screen.queryByText('first', { includeHiddenElements: true })).toBeNull();
  await act(async () => finishOld(true));
  expect(screen.getByText('second')).toBeTruthy();
});

test('completion cleanup works in StrictMode and tolerates callbacks after unmount', async () => {
  const view = await render(<StrictMode>{content('first')}</StrictMode>);
  await view.rerender(<StrictMode>{content('second')}</StrictMode>);
  const finish = outgoingAnimation();
  await act(async () => finish(true));
  expect(screen.queryByText('first', { includeHiddenElements: true })).toBeNull();
  await view.unmount();
  await act(async () => finish(true));
});
