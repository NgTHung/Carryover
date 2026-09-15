/** Native route controller for creating a transfer between active accounts. */
import { router, useFocusEffect, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { ActiveAccount } from '../../data/accounts';
import { Button } from '../../ui/Button';
import {
  getTransferCreationData,
  subscribeLedgerChanges,
} from '../../ui/ledger-access';
import { TransferForm } from '../../ui/transfers/TransferForm';
import type { TransferCreationData } from '../../ui/transfers/transfer-data-contract';
import { initializeTransferForm } from '../../ui/transfers/transfer-form';

type TransferLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unavailable'; message: string }
  | {
      status: 'ready';
      accounts: ActiveAccount[];
      refreshError?: string;
      pairError?: string;
    };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function Message({
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
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">{title}</Text>
      <Text accessibilityRole="alert" className="text-body text-muted-light dark:text-muted-dark" selectable>{detail}</Text>
      {action}
    </View>
  );
}

export default function NewTransferRoute({
  data = getTransferCreationData(),
  subscribe = subscribeLedgerChanges,
  now = () => new Date(),
}: {
  data?: TransferCreationData;
  subscribe?: typeof subscribeLedgerChanges;
  now?: () => Date;
}) {
  const [openedAt] = useState(() => now());
  const [state, setState] = useState<TransferLoadState>({ status: 'loading' });
  const [retryToken, setRetryToken] = useState(0);
  const [writePending, setWritePending] = useState(false);
  const [navigationIntent, setNavigationIntent] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [navigationError, setNavigationError] = useState<string>();
  const requestRef = useRef(0);
  const mountedRef = useRef(false);
  const focusedRef = useRef(false);
  const writePendingRef = useRef(false);

  const load = useCallback(
    async (showLoading: boolean): Promise<void> => {
      const request = requestRef.current + 1;
      requestRef.current = request;
      if (showLoading) setState({ status: 'loading' });
      try {
        const accounts = await data.listActiveAccounts();
        if (!mountedRef.current || request !== requestRef.current) return;
        const initialized = initializeTransferForm(accounts, openedAt);
        if (initialized.status === 'error') {
          setState((current) =>
            !showLoading && current.status === 'ready'
              ? { ...current, pairError: initialized.message, refreshError: undefined }
              : { status: 'unavailable', message: initialized.message }
          );
          return;
        }
        setState({ status: 'ready', accounts });
      } catch (error: unknown) {
        if (mountedRef.current && request === requestRef.current) {
          const message = errorMessage(error);
          setState((current) =>
            !showLoading && current.status === 'ready'
              ? { ...current, refreshError: message }
              : { status: 'error', message }
          );
        }
        throw error;
      }
    },
    [data, openedAt]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void load(true).catch(() => undefined);
  }, [load, retryToken]);

  useFocusEffect(
    useCallback(() => {
      if (focusedRef.current) void load(false).catch(() => undefined);
      focusedRef.current = true;
      return undefined;
    }, [load])
  );

  useEffect(
    () =>
      subscribe((change) => {
        if (change.table === 'accounts') void load(false).catch(() => undefined);
      }),
    [load, subscribe]
  );

  const updateWritePending = useCallback((pending: boolean) => {
    writePendingRef.current = pending;
    setWritePending(pending);
  }, []);

  const preventRemove = useCallback(() => {
    if (!writePendingRef.current) return;
  }, []);
  usePreventRemove(writePending, preventRemove);

  useEffect(() => {
    if (!navigationIntent || writePending) return;
    try {
      router.replace('/settings/accounts' as Href);
    } catch (error: unknown) {
      setNavigationIntent(false);
      setNavigationError(errorMessage(error));
    }
  }, [navigationIntent, writePending]);

  const cancel = useCallback(() => {
    if (writePendingRef.current) return;
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/settings/accounts' as Href);
      }
    } catch (error: unknown) {
      setNavigationError(errorMessage(error));
    }
  }, []);

  const commit = useCallback(() => {
    setCommitted(true);
    setNavigationError(undefined);
    setNavigationIntent(true);
  }, []);

  const retryNavigation = useCallback(() => {
    setNavigationError(undefined);
    setNavigationIntent(true);
  }, []);

  if (state.status === 'loading') {
    return <Message title="Record transfer" detail="Loading active accounts…" />;
  }
  if (state.status === 'error') {
    return (
      <Message
        title="Transfer could not load"
        detail={state.message}
        action={<Button onPress={() => setRetryToken((value) => value + 1)}>Try again</Button>}
      />
    );
  }
  if (state.status === 'unavailable') {
    return (
      <Message
        title="Transfer unavailable"
        detail={state.message}
        action={<Button variant="secondary" onPress={cancel}>Back to accounts</Button>}
      />
    );
  }

  const accountDataMessage = state.refreshError ?? state.pairError;
  return (
    <TransferForm
      accounts={state.accounts}
      openedAt={openedAt}
      data={data}
      onCancel={cancel}
      onCommitted={commit}
      onWritePending={updateWritePending}
      navigationError={navigationError}
      onRetryNavigation={committed ? retryNavigation : undefined}
      accountDataMessage={accountDataMessage}
      onRetryAccountData={() => void load(false).catch(() => undefined)}
      now={now}
    />
  );
}
