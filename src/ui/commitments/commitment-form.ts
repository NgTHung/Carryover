/**
 * Pure form rules for creating and editing recurring commitments.
 *
 * Text stays unparsed until validation so money reaches the data boundary only
 * after exact whole-dong conversion. Leaf availability mirrors write policy.
 */
import type { CategoryGroupWithLeaves } from '../../data/category-types';
import type { CommitmentOverviewLeaf } from '../../data/commitment-overview';
import {
  commitmentDueDaySchema,
  commitmentNameSchema,
  type Commitment,
  type CreateCommitmentInput,
  type EditCommitmentInput,
} from '../../data/commitment-validation';
import { positiveVndInputSchema } from '../../data/money-validation';

export type CommitmentFormValues = {
  name: string;
  amount: string;
  dueDay: string;
  categoryId: string | null;
};

export type CommitmentFormErrors = {
  name?: string;
  amount?: string;
  dueDay?: string;
  leaf?: string;
  form?: string;
};

export type ReserveLeafChoice = {
  id: string;
  name: string;
  groupName: string;
};

export type CommitmentFormMode =
  | { status: 'create' }
  | { status: 'edit'; commitment: Commitment };

export type ValidatedCommitmentForm = {
  valid: true;
  name: string;
  amount: number;
  dueDay: number;
  categoryId: string;
  errors: CommitmentFormErrors;
};

export type CommitmentFormValidation =
  | ValidatedCommitmentForm
  | { valid: false; errors: CommitmentFormErrors };

export type CommitmentCreatePayload = Omit<CreateCommitmentInput, 'active'>;

export function initializeCommitmentCreateForm(): CommitmentFormValues {
  return { name: '', amount: '', dueDay: '', categoryId: null };
}

export function initializeCommitmentEditForm(
  commitment: Commitment
): CommitmentFormValues {
  return {
    name: commitment.name,
    amount: commitment.amount.toString(),
    dueDay: commitment.dueDay.toString(),
    categoryId: commitment.categoryId,
  };
}

export function reserveLeafChoices(
  groups: readonly CategoryGroupWithLeaves[]
): ReserveLeafChoice[] {
  return groups
    .filter((group) => group.kind === 'reserve')
    .flatMap((group) =>
      group.leaves
        .filter((leaf) => leaf.kind === 'reserve')
        .map((leaf) => ({
          id: leaf.id,
          name: leaf.name,
          groupName: group.name,
        }))
    );
}

export function presentStoredCommitmentLeaf(
  leaf: CommitmentOverviewLeaf,
  choices: readonly ReserveLeafChoice[]
): { id: string; label: string; selectable: boolean } {
  const names = [leaf.groupName, leaf.name].filter(
    (value): value is string => value !== null
  );
  return {
    id: leaf.id,
    label: names.length > 0 ? names.join(' / ') : 'Unavailable reserve leaf',
    selectable: leaf.active && choices.some(({ id }) => id === leaf.id),
  };
}

export function commitmentActivationError(
  commitment: Commitment,
  choices: readonly ReserveLeafChoice[]
): string | undefined {
  return choices.some(({ id }) => id === commitment.categoryId)
    ? undefined
    : 'Select an active reserve leaf before reactivating this commitment.';
}

function parseDueDay(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number.parseInt(value, 10);
  const result = commitmentDueDaySchema.safeParse(parsed);
  return result.success ? result.data : undefined;
}

export function validateCommitmentForm(
  values: CommitmentFormValues,
  choices: readonly ReserveLeafChoice[],
  mode: CommitmentFormMode
): CommitmentFormValidation {
  const errors: CommitmentFormErrors = {};
  const name = commitmentNameSchema.safeParse(values.name);
  const amount = positiveVndInputSchema.safeParse(values.amount);
  const dueDay = parseDueDay(values.dueDay);

  if (!name.success) errors.name = 'Enter a commitment name.';
  if (!amount.success) errors.amount = 'Enter a positive whole-dong amount.';
  if (dueDay === undefined) errors.dueDay = 'Enter a due day from 1 to 31.';

  const categoryId = values.categoryId;
  const categoryIsActive =
    categoryId !== null && choices.some(({ id }) => id === categoryId);
  const keepsUnavailableInactiveLeaf =
    mode.status === 'edit' &&
    !mode.commitment.active &&
    categoryId === mode.commitment.categoryId;
  if (categoryId === null || (!categoryIsActive && !keepsUnavailableInactiveLeaf)) {
    errors.leaf = 'Select an active reserve leaf.';
  }

  if (
    Object.keys(errors).length > 0 ||
    !name.success ||
    !amount.success ||
    dueDay === undefined ||
    categoryId === null
  ) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    name: name.data,
    amount: amount.data,
    dueDay,
    categoryId,
    errors,
  };
}

export function buildCommitmentCreateInput(
  validation: ValidatedCommitmentForm
): CommitmentCreatePayload {
  return {
    name: validation.name,
    amount: validation.amount,
    dueDay: validation.dueDay,
    categoryId: validation.categoryId,
  };
}

export function buildCommitmentEditInput(
  commitment: Commitment,
  validation: ValidatedCommitmentForm
): EditCommitmentInput {
  const changes: EditCommitmentInput['changes'] = {};
  if (validation.name !== commitment.name) changes.name = validation.name;
  if (validation.amount !== commitment.amount) changes.amount = validation.amount;
  if (validation.dueDay !== commitment.dueDay) changes.dueDay = validation.dueDay;
  if (validation.categoryId !== commitment.categoryId) {
    changes.categoryId = validation.categoryId;
  }
  return { commitmentId: commitment.id, changes };
}
