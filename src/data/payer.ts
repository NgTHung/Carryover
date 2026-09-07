/**
 * Converts the nullable payer foreign key into an explicit domain value.
 *
 * Null is a meaningful value in the ledger: it means the payer is you. Keeping
 * that interpretation at the data boundary prevents callers from treating it
 * as a missing contact.
 */
export type Payer =
  | { kind: 'you' }
  | { kind: 'contact'; contactId: string };

export function payerFromNullableId(contactId: string | null): Payer {
  return contactId === null ? { kind: 'you' } : { kind: 'contact', contactId };
}

export function nullableIdFromPayer(payer: Payer): string | null {
  return payer.kind === 'you' ? null : payer.contactId;
}
