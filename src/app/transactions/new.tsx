/**
 * Native route for creating a complete manual expense or income.
 *
 * This controller owns loading, navigation, and the removal guard. The
 * creator owns only form state and the single committed mutation.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { Transaction } from '../../data/transaction-validation';
import { Button } from '../../ui';
import {
  getTransactionCreateData,
} from '../../ui/ledger-access';
import { TransactionCreator } from '../../ui/transactions/TransactionCreator';
import type { TransactionCreateData } from '../../ui/transactions/transaction-create-contract';
import {
  parseTransactionCreationRoute,
  type ParsedTransactionCreationRoute,
} from '../../ui/transactions/load-transaction-route';
import { TransactionRouteView } from '../../ui/transactions/TransactionRouteView';
import { useTransactionFilters } from '../../ui/transactions/transaction-filters';

type CreationLoadState =
  | Extract<ParsedTransactionCreationRoute, { status: 'invalid' }>
  | { status: 'loading' }
  | {
      status: 'ready';
      direction: Extract<ParsedTransactionCreationRoute, { status: 'valid' }>['direction'];
      accounts: Awaited<ReturnType<TransactionCreateData['listActiveAccounts']>>;
      groups: Awaited<ReturnType<TransactionCreateData['listActiveCategoryGroups']>>;
    }
  | { status: 'error'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function CreationMessage({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <View className="flex-1 gap-3 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">LEDGER</Text>
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
        {title}
      </Text>
      <Text className="text-body text-muted-light dark:text-muted-dark" selectable>
        {detail}
      </Text>
      {action}
    </View>
  );
}

export default function NewTransactionRoute({
  data = getTransactionCreateData(),
}: {
  data?: TransactionCreateData;
}) {
  const { direction: directionParam } = useLocalSearchParams<{
    direction?: string | string[];
  }>();
  const directionKey = Array.isArray(directionParam)
    ? directionParam.join('\u0000')
    : directionParam;
  const parsed = useMemo(
    () => parseTransactionCreationRoute(directionParam),
    [directionKey]
  );
  const [state, setState] = useState<CreationLoadState>(() =>
    parsed.status === 'invalid' ? parsed : { status: 'loading' }
  );
  const [retryToken, setRetryToken] = useState(0);
  const [openedAt] = useState(() => new Date());
  const [writePending, setWritePending] = useState(false);
  const writePendingRef = useRef(false);
  const [savedTransaction, setSavedTransaction] = useState<Transaction>();
  const [navigationIntent, setNavigationIntent] = useState<Transaction>();
  const [navigationError, setNavigationError] = useState<string>();

  const preventRemove = useCallback(() => {
    if (!writePendingRef.current) return;
  }, []);
  usePreventRemove(writePending, preventRemove);

  useEffect(() => {
    if (parsed.status === 'invalid') {
      setState(parsed);
      return undefined;
    }

    let cancelled = false;
    setState({ status: 'loading' });
    void Promise.all([
      data.listActiveAccounts(),
      data.listActiveCategoryGroups(),
    ])
      .then(([accounts, groups]) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          direction: parsed.direction,
          accounts,
          groups,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', message: errorMessage(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [data, directionKey, parsed, retryToken]);

  useEffect(() => {
    if (writePending || navigationIntent === undefined) return;

    try {
      router.replace('/transactions' as Href);
    } catch (error: unknown) {
      setNavigationIntent(undefined);
      setNavigationError(errorMessage(error));
    }
  }, [navigationIntent, writePending]);

  const updateWritePending = useCallback((pending: boolean) => {
    if (writePendingRef.current === pending) return;
    writePendingRef.current = pending;
    setWritePending(pending);
  }, []);

  const cancel = useCallback(() => {
    if (writePendingRef.current) return;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/transactions' as Href);
    }
  }, []);

  const queueNavigation = useCallback((transaction: Transaction) => {
    useTransactionFilters.getState().revealTransaction(transaction.occurredAt);
    setNavigationError(undefined);
    setNavigationIntent(transaction);
  }, []);

  const commit = useCallback((transaction: Transaction) => {
    setSavedTransaction(transaction);
    queueNavigation(transaction);
  }, [queueNavigation]);

  const retryNavigation = useCallback(() => {
    if (savedTransaction === undefined) return;
    queueNavigation(savedTransaction);
  }, [queueNavigation, savedTransaction]);

  if (state.status === 'invalid') {
    return <TransactionRouteView state={state} />;
  }
  if (state.status === 'loading') {
    return <CreationMessage title="New transaction" detail="Loading accounts and categories." />;
  }
  if (state.status === 'error') {
    return (
      <CreationMessage
        title="New transaction could not load"
        detail={state.message}
        action={<Button onPress={() => setRetryToken((value) => value + 1)}>Try again</Button>}
      />
    );
  }

  return (
    <TransactionCreator
      direction={state.direction}
      accounts={state.accounts}
      groups={state.groups}
      openedAt={openedAt}
      data={data}
      onCancel={cancel}
      onCommitted={commit}
      onWritePending={updateWritePending}
      navigationError={navigationError}
      onRetryNavigation={retryNavigation}
    />
  );
}
