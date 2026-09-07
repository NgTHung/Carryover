import {
  nullableIdFromPayer,
  payerFromNullableId,
} from '../src/data/payer';

test('payer conversion preserves your meaning and contact identity', () => {
  expect(payerFromNullableId(null)).toEqual({ kind: 'you' });
  expect(nullableIdFromPayer({ kind: 'you' })).toBeNull();

  const contact = { kind: 'contact' as const, contactId: 'contact-1' };
  expect(payerFromNullableId('contact-1')).toEqual(contact);
  expect(nullableIdFromPayer(contact)).toBe('contact-1');
});
