/** One commitment with explicit management actions and period status. */
import { Text, View } from 'react-native';

import type { CommitmentOverviewItem } from '../../data/commitment-overview';
import { formatVnd } from '../../money/currency';
import { Button } from '../Button';

function statusText(item: CommitmentOverviewItem): string {
  if (item.state.status === 'inactive') return 'Inactive';
  if (item.state.status === 'paid') return 'Paid';
  return 'Unpaid';
}

export function CommitmentCard({
  item,
  disabled,
  confirmingDelete,
  confirmingDeactivate,
  onEdit,
  onToggleActive,
  onBeginDelete,
  onConfirmDelete,
  onCancelDelete,
  onConfirmDeactivate,
  onCancelDeactivate,
}: {
  item: CommitmentOverviewItem;
  disabled: boolean;
  confirmingDelete: boolean;
  confirmingDeactivate: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onBeginDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDeactivate: () => void;
  onCancelDeactivate: () => void;
}) {
  const leafName = [item.leaf.groupName, item.leaf.name]
    .filter((value): value is string => value !== null)
    .join(' / ');
  return (
    <View className="gap-3 rounded-surface border border-faint-light bg-surface-light p-4 dark:border-faint-dark dark:bg-surface-dark">
      <View className="gap-1">
        <Text className="text-body font-semibold text-ink-light dark:text-ink-dark">
          {item.commitment.name}
        </Text>
        <Text className="text-body tabular-nums text-ink-light dark:text-ink-dark">
          {formatVnd(item.commitment.amount)} reserved, due day {item.commitment.dueDay}
        </Text>
        <Text className="text-detail text-muted-light dark:text-muted-dark">
          {leafName || 'Unavailable reserve leaf'} · {statusText(item)}
        </Text>
        {!item.leaf.active ? (
          <Text className="text-detail text-error-light dark:text-error-dark">
            This reserve leaf is unavailable.
          </Text>
        ) : null}
      </View>
      {confirmingDelete ? (
        <View className="gap-2">
          <Text className="text-detail text-muted-light dark:text-muted-dark">
            Delete removes this commitment from Settings. Existing transactions stay in the ledger.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Button variant="danger" disabled={disabled} onPress={onConfirmDelete}>
              Confirm delete
            </Button>
            <Button variant="secondary" disabled={disabled} onPress={onCancelDelete}>
              Cancel delete
            </Button>
          </View>
        </View>
      ) : confirmingDeactivate ? (
        <View className="gap-2">
          <Text className="text-detail text-muted-light dark:text-muted-dark">
            Deactivation stops this commitment from reserving money. You can reactivate it later.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Button variant="danger" disabled={disabled} onPress={onConfirmDeactivate}>
              Confirm deactivate
            </Button>
            <Button variant="secondary" disabled={disabled} onPress={onCancelDeactivate}>
              Cancel deactivate
            </Button>
          </View>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          <Button variant="secondary" disabled={disabled} onPress={onEdit}>Edit</Button>
          <Button variant="secondary" disabled={disabled} onPress={onToggleActive}>
            {item.commitment.active ? 'Deactivate' : 'Reactivate'}
          </Button>
          <Button variant="danger" disabled={disabled} onPress={onBeginDelete}>Delete</Button>
        </View>
      )}
    </View>
  );
}
