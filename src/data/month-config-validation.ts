/**
 * Runtime contracts for per-period month config snapshots.
 *
 * The three money totals are supplied when a period opens and become the
 * historical inputs for reports. Only the horizon can be edited later, so
 * validation keeps the snapshot shape strict at both boundaries.
 */
import { z } from 'zod';

import { dateOnlySchema } from './date-only';
import { nonNegativeVndAmountSchema } from './money-validation';
import {
  periodEndDate,
  periodSchema,
  periodStartDate,
  type Period,
} from './period';

function addHorizonBeforePeriodIssue(
  period: Period,
  horizonDate: string,
  context: z.RefinementCtx
): void {
  if (horizonDate < periodStartDate(period)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['horizonDate'],
      message: 'horizon date cannot precede the period start',
    });
  }
}

const monthConfigFields = {
  period: periodSchema,
  openingBalance: nonNegativeVndAmountSchema,
  incomeTotal: nonNegativeVndAmountSchema,
  reservedTotal: nonNegativeVndAmountSchema,
  horizonDate: dateOnlySchema,
};

export const monthConfigSchema = z
  .object(monthConfigFields)
  .strict()
  .superRefine((input, context) => {
    addHorizonBeforePeriodIssue(input.period, input.horizonDate, context);
  });

export type MonthConfig = z.infer<typeof monthConfigSchema>;

export const openPeriodInputSchema = z
  .object({
    period: periodSchema,
    openingBalance: nonNegativeVndAmountSchema,
    incomeTotal: nonNegativeVndAmountSchema,
    reservedTotal: nonNegativeVndAmountSchema,
    horizonDate: dateOnlySchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.horizonDate !== undefined) {
      addHorizonBeforePeriodIssue(input.period, input.horizonDate, context);
    }
  })
  .transform((input) => ({
    ...input,
    horizonDate: input.horizonDate ?? periodEndDate(input.period),
  }));

export type OpenPeriodInput = z.input<typeof openPeriodInputSchema>;

export const updateHorizonInputSchema = z
  .object({
    period: periodSchema,
    horizonDate: dateOnlySchema,
  })
  .strict()
  .superRefine((input, context) => {
    addHorizonBeforePeriodIssue(input.period, input.horizonDate, context);
  });

export type UpdateHorizonInput = z.infer<typeof updateHorizonInputSchema>;
