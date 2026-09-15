import {
  parseCaptureRoute,
  resolveCaptureRoute,
} from '../src/ui/capture/capture-route';
import type { Transaction } from '../src/data/transaction-validation';

const draftId = '123e4567-e89b-42d3-a456-426614174000';
const accountId = '123e4567-e89b-42d3-a456-426614174002';
const photoKey = 'photos/v1/123e4567-e89b-42d3-a456-426614174001.jpg';
const timestamp = new Date(2026, 8, 15, 12);

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: draftId,
    accountId,
    direction: 'expense',
    adjustmentEffect: null,
    amount: null,
    categoryId: null,
    quality: null,
    payer: { kind: 'you' },
    occurredAt: timestamp,
    status: 'draft',
    photoKey,
    note: null,
    sourceLabel: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    ...overrides,
  } as Transaction;
}

test('accepts one UUID route value and rejects arrays or malformed ids', () => {
  expect(parseCaptureRoute(draftId)).toEqual({ status: 'valid', draftId });
  expect(parseCaptureRoute([draftId])).toEqual({
    status: 'invalid',
    message: 'This capture link is invalid.',
  });
  expect(parseCaptureRoute('capture-1')).toEqual({
    status: 'invalid',
    message: 'This capture link is invalid.',
  });
});

test('allows a missing row to start a new capture', () => {
  expect(resolveCaptureRoute(undefined)).toEqual({ status: 'new' });
});

test('recognizes only an active photo-backed expense draft as saved', () => {
  expect(resolveCaptureRoute(transaction())).toMatchObject({ status: 'saved' });
  expect(resolveCaptureRoute(transaction({ photoKey: null }))).toMatchObject({
    status: 'collision',
  });
  expect(resolveCaptureRoute(transaction({ status: 'complete', amount: 100 }))).toMatchObject({
    status: 'collision',
  });
  expect(resolveCaptureRoute(transaction({ deletedAt: timestamp }))).toMatchObject({
    status: 'collision',
  });
  expect(resolveCaptureRoute(transaction({ direction: 'income' }))).toMatchObject({
    status: 'collision',
  });
  expect(resolveCaptureRoute(transaction({ photoKey: 'file:///cache/photo.jpg' }))).toMatchObject({
    status: 'collision',
  });
});
