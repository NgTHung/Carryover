import {
  DRAFT_RETURN_ROUTE,
  parseTransactionReturnRoute,
  TRANSACTION_RETURN_ROUTE,
} from '../src/ui/transactions/transaction-return-route';

test('maps the exact Drafts origin to the fixed inbox destination', () => {
  expect(parseTransactionReturnRoute('drafts')).toBe(DRAFT_RETURN_ROUTE);
});

test.each([undefined, 'transactions', 'https://example.test', ['drafts']])(
  'falls back to transactions for an untrusted origin %p',
  (value) => {
    expect(parseTransactionReturnRoute(value)).toBe(TRANSACTION_RETURN_ROUTE);
  }
);
