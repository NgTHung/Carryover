/** Operations needed by commitment management after the migration gate. */
import type { CategoryGroupWithLeaves } from '../../data/category-types';
import type { CommitmentOverview } from '../../data/commitment-overview';
import type {
  Commitment,
  EditCommitmentInput,
} from '../../data/commitment-validation';
import type { CommitmentCreatePayload } from './commitment-form';

export type CommitmentManagerData = {
  readCommitmentOverview(period: unknown): Promise<CommitmentOverview>;
  listActiveCategoryGroups(): Promise<CategoryGroupWithLeaves[]>;
  createCommitment(input: CommitmentCreatePayload): Promise<Commitment>;
  editCommitment(input: EditCommitmentInput): Promise<Commitment>;
  softDeleteCommitment(commitmentId: string): Promise<void>;
};
