/**
 * Validates the small input that crosses the photo-to-ledger boundary.
 *
 * Capture keeps the route id and retained photo key separate so a retry can
 * identify the same draft without ever persisting a temporary file URI.
 */
import { z } from 'zod';

import { photoKeySchema, type PhotoKey } from '../photos/photo-contract';
import { draftVndInputSchema } from './money-validation';

const capturedDraftInputSchema = z
  .object({
    draftId: z.string().uuid(),
    photoKey: photoKeySchema,
    amount: draftVndInputSchema.default(null),
    occurredAt: z.date().refine(
      (value) => !Number.isNaN(value.getTime()),
      'occurredAt must be a valid date'
    ),
  })
  .strict();

export type CreateCapturedDraftInput = {
  draftId: string;
  photoKey: PhotoKey;
  amount: string | number | null;
  occurredAt: Date;
};

export type ParsedCapturedDraftInput = z.infer<typeof capturedDraftInputSchema>;

export function parseCapturedDraftInput(
  input: CreateCapturedDraftInput | unknown
): ParsedCapturedDraftInput {
  return capturedDraftInputSchema.parse(input);
}
