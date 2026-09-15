/** Native route controller for account details and reconcile. */
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import type { AccountBalance } from '../../data/accounts';
import { Button } from '../../ui/Button';
import {
  AccountReconcileScreen,
} from '../../ui/accounts/AccountReconcileScreen';
import type { AccountEditorData } from '../../ui/accounts/account-editor-contract';
import {
  getAccountEditorData,
  subscribeLedgerChanges,
} from '../../ui/ledger-access';

type AccountsLoadState =
  | { status: 'loading' }
  | { status: 'ready'; accounts: AccountBalance[]; refreshError?: string }
  | { status: 'error'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <View className="flex-1 gap-2 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
        {title}
      </Text>
      <Text className="text-body text-muted-light dark:text-muted-dark">{detail}</Text>
    </View>
  );
}

export default function AccountsRoute({
  data = getAccountEditorData(),
  subscribe = subscribeLedgerChanges,
}: {
  data?: AccountEditorData;
  subscribe?: typeof subscribeLedgerChanges;
}) {
  const [state, setState] = useState<AccountsLoadState>({ status: 'loading' });
  const requestRef = useRef(0);
  const mountedRef = useRef(false);
  const writePendingRef = useRef(false);
  const [writePending, setWritePending] = useState(false);

  const load = useCallback(
    async (showLoading: boolean): Promise<void> => {
      const request = requestRef.current + 1;
      requestRef.current = request;
      if (showLoading) setState({ status: 'loading' });
      try {
        const accounts = await data.readAccountBalances();
        if (!mountedRef.current || request !== requestRef.current) return;
        setState({ status: 'ready', accounts });
      } catch (error: unknown) {
        if (mountedRef.current && request === requestRef.current) {
          if (showLoading) {
            setState({ status: 'error', message: errorMessage(error) });
          } else {
            setState((current) =>
              current.status === 'ready'
                ? { ...current, refreshError: errorMessage(error) }
                : current
            );
          }
        }
        throw error;
      }
    },
    [data]
  );

  const refresh = useCallback(() => load(false), [load]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void load(true).catch(() => undefined);
  }, [load]);

  useEffect(
    () =>
      subscribe((change) => {
        if (
          change.table === 'accounts' ||
          change.table === 'transactions' ||
          change.table === 'transfers'
        ) {
          void refresh().catch(() => undefined);
        }
      }),
    [refresh, subscribe]
  );

  const updateWritePending = useCallback((pending: boolean) => {
    if (writePendingRef.current === pending) return;
    writePendingRef.current = pending;
    setWritePending(pending);
  }, []);

  const preventRemove = useCallback(() => {
    if (!writePendingRef.current) return;
  }, []);
  usePreventRemove(writePending, preventRemove);

  if (state.status === 'loading') {
    return <Message title="Accounts" detail="Loading account balances…" />;
  }

  if (state.status === 'error') {
    return (
      <View className="flex-1 gap-3 bg-ground-light px-5 py-16 dark:bg-ground-dark">
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          Accounts
        </Text>
        <Text accessibilityRole="alert" className="text-body text-error-light dark:text-error-dark">
          {state.message}
        </Text>
        <Button onPress={() => void load(true).catch(() => undefined)}>Try again</Button>
      </View>
    );
  }

  return (
    <AccountReconcileScreen
      accounts={state.accounts}
      data={data}
      onReload={refresh}
      onRetryRead={refresh}
      onWritePending={updateWritePending}
      refreshError={state.refreshError}
    />
  );
}
