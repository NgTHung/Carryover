import { cleanup, render, screen, userEvent } from '@testing-library/react-native';

import { Button } from '../src/ui/Button';
import { Input } from '../src/ui/Input';
import { QualityChip } from '../src/ui/QualityChip';

afterEach(() => {
  cleanup();
});

test('button exposes a labelled action and forwards presses', async () => {
  const onPress = jest.fn();
  const user = userEvent.setup();

  await render(<Button onPress={onPress}>Save transaction</Button>);
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));

  expect(onPress).toHaveBeenCalledTimes(1);
});

test('disabled button does not invoke its action', async () => {
  const onPress = jest.fn();
  const user = userEvent.setup();

  await render(
    <Button disabled onPress={onPress} variant="secondary">
      Save transaction
    </Button>
  );
  await user.press(screen.getByRole('button', { name: 'Save transaction' }));

  expect(onPress).not.toHaveBeenCalled();
});

test('input exposes its label and validation message', async () => {
  await render(<Input label="Amount" error="Enter an amount" />);

  expect(screen.getByLabelText('Amount')).toBeTruthy();
  expect(screen.getByText('Enter an amount')).toBeTruthy();
  expect(screen.getByLabelText('Amount').props.accessibilityHint).toBe('Enter an amount');
});

test('disabled input state prevents editing', async () => {
  await render(<Input label="Note" state="disabled" />);

  expect(screen.getByLabelText('Note').props.editable).toBe(false);
});

test('quality chip keeps its label and selected accessibility state', async () => {
  const onPress = jest.fn();
  const user = userEvent.setup();

  await render(<QualityChip quality="need" selected onPress={onPress} />);
  const chip = screen.getByRole('button', { name: 'need' });

  expect(chip.props.accessibilityState).toEqual({ selected: true });
  await user.press(chip);
  expect(onPress).toHaveBeenCalledTimes(1);
});
