import { router, useLocalSearchParams, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { resolvePhoto as nativeResolvePhoto } from '../../photos/photo-access';
import {
  getTransactionEditorData,
  subscribeLedgerChanges,
} from '../../ui/ledger-access';
import { loadTransactionRoute, parseTransactionRoute } from '../../ui/transactions/load-transaction-route';
import { TransactionEditor } from '../../ui/transactions/TransactionEditor';
import { TransactionAdjustmentDetail } from '../../ui/transactions/TransactionAdjustmentDetail';
import type { PhotoThumbnailResolver } from '../../ui/photos/PhotoThumbnail';
import {
  TransactionRouteView,
  type TransactionRouteState,
} from '../../ui/transactions/TransactionRouteView';
import type { TransactionEditorData } from '../../ui/transactions/transaction-editor-contract';
import {
  parseTransactionReturnRoute,
  type TransactionReturnRoute,
} from '../../ui/transactions/transaction-return-route';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type RouteState = TransactionRouteState | {
  status: 'ready';
  transaction: Awaited<ReturnType<TransactionEditorData['readTransaction']>> & {};
  groups: Awaited<ReturnType<TransactionEditorData['listActiveCategoryGroups']>>;
  accounts: Awaited<ReturnType<TransactionEditorData['listActiveAccounts']>>;
  accountRefreshError?: string;
  categoryRefreshError?: string;
};

export default function TransactionRouteScreen({
  data = getTransactionEditorData(),
  subscribe = subscribeLedgerChanges,
  resolvePhoto = nativeResolvePhoto,
}: {
  data?: TransactionEditorData;
  subscribe?: typeof subscribeLedgerChanges;
  resolvePhoto?: PhotoThumbnailResolver;
}) {
  const { transactionId, from } = useLocalSearchParams<{
    transactionId?: string | string[];
    from?: string | string[];
  }>();
  const returnRoute: TransactionReturnRoute = parseTransactionReturnRoute(from);
  const [state, setState] = useState<RouteState>(() => {
    const parsed = parseTransactionRoute(transactionId);
    return parsed.status === 'invalid' ? parsed : { status: 'loading' };
  });
  const routeRequestRef = useRef(0);
  const mountedRef = useRef(false);
  const accountRefreshRequestRef = useRef(0);
  const categoryRefreshRequestRef = useRef(0);
  const writePendingRef = useRef(false);
  const [writePending, setWritePending] = useState(false);
  const [navigationIntent, setNavigationIntent] = useState(false);
  const [navigationError, setNavigationError] = useState<string>();

  const preventRemove = useCallback(() => {
    if (!writePendingRef.current) return;
  }, []);
  usePreventRemove(writePending, preventRemove);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      routeRequestRef.current += 1;
      accountRefreshRequestRef.current += 1;
      categoryRefreshRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const parsed = parseTransactionRoute(transactionId);
    const routeRequest = routeRequestRef.current + 1;
    routeRequestRef.current = routeRequest;
    writePendingRef.current = false;
    setWritePending(false);
    setNavigationIntent(false);
    setNavigationError(undefined);
    if (parsed.status === 'invalid') {
      setState(parsed);
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    void loadTransactionRoute(parsed.transactionId, data.readTransaction)
      .then(async (result) => {
        if (cancelled || routeRequest !== routeRequestRef.current) return;
        if (result.status === 'invalid') {
          setState(result);
        } else if (result.status === 'unavailable') {
          setState(result);
        } else {
          const [groups, accounts] = await Promise.all([
            data.listActiveCategoryGroups(),
            data.listActiveAccounts(),
          ]);
          if (cancelled || routeRequest !== routeRequestRef.current) return;
          setState({
            status: 'ready',
            transaction: result.transaction,
            groups,
            accounts,
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled || routeRequest !== routeRequestRef.current) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [data, transactionId]);

  useEffect(() => {
    if (writePending || !navigationIntent) return;
    try {
      router.replace(returnRoute.destination as Href);
    } catch (error: unknown) {
      setNavigationIntent(false);
      setNavigationError(errorMessage(error));
    }
  }, [navigationIntent, returnRoute.destination, writePending]);

  const updateWritePending = useCallback((pending: boolean) => {
    if (writePendingRef.current === pending) return;
    writePendingRef.current = pending;
    setWritePending(pending);
  }, []);

  const queueNavigation = useCallback(() => {
    setNavigationError(undefined);
    setNavigationIntent(true);
  }, []);

  const retryNavigation = useCallback(() => {
    queueNavigation();
  }, [queueNavigation]);

  const refreshAccounts = useCallback(() => {
    const routeRequest = routeRequestRef.current;
    const request = accountRefreshRequestRef.current + 1;
    accountRefreshRequestRef.current = request;
    void data.listActiveAccounts()
      .then((accounts) => {
        if (
          !mountedRef.current ||
          routeRequest !== routeRequestRef.current ||
          request !== accountRefreshRequestRef.current
        ) return;
        setState((current) =>
          current.status === 'ready'
            ? { ...current, accounts, accountRefreshError: undefined }
            : current
        );
      })
      .catch((error: unknown) => {
        if (
          !mountedRef.current ||
          routeRequest !== routeRequestRef.current ||
          request !== accountRefreshRequestRef.current
        ) return;
        setState((current) =>
          current.status === 'ready'
            ? {
                ...current,
                accountRefreshError: error instanceof Error ? error.message : String(error),
              }
            : current
        );
      });
  }, [data]);

  const refreshCategories = useCallback(() => {
    const routeRequest = routeRequestRef.current;
    const request = categoryRefreshRequestRef.current + 1;
    categoryRefreshRequestRef.current = request;
    void data.listActiveCategoryGroups()
      .then((groups) => {
        if (
          !mountedRef.current ||
          routeRequest !== routeRequestRef.current ||
          request !== categoryRefreshRequestRef.current
        ) return;
        setState((current) =>
          current.status === 'ready'
            ? { ...current, groups, categoryRefreshError: undefined }
            : current
        );
      })
      .catch((error: unknown) => {
        if (
          !mountedRef.current ||
          routeRequest !== routeRequestRef.current ||
          request !== categoryRefreshRequestRef.current
        ) return;
        setState((current) =>
          current.status === 'ready'
            ? {
                ...current,
                categoryRefreshError: error instanceof Error ? error.message : String(error),
              }
            : current
        );
      });
  }, [data]);

  useEffect(
    () => {
      let active = true;
      const unsubscribe = subscribe((change) => {
        if (!active) return;
        if (change.table === 'accounts') refreshAccounts();
        if (change.table === 'categories') refreshCategories();
      });
      return () => {
        active = false;
        accountRefreshRequestRef.current += 1;
        categoryRefreshRequestRef.current += 1;
        unsubscribe();
      };
    },
    [refreshAccounts, refreshCategories, subscribe]
  );

  if (state.status === 'ready') {
    if (state.transaction.direction === 'adjustment') {
      const account = state.accounts.find((candidate) => candidate.accountId === state.transaction.accountId);
      return (
        <TransactionAdjustmentDetail
          transaction={state.transaction}
          account={account}
          onDone={() => router.replace(returnRoute.destination as Href)}
        />
      );
    }
    return (
      <TransactionEditor
        key={state.transaction.id}
        transaction={state.transaction}
        groups={state.groups}
        accounts={state.accounts}
        data={data}
        resolvePhoto={resolvePhoto}
        accountRefreshError={state.accountRefreshError}
        onRetryAccountRefresh={refreshAccounts}
        categoryRefreshError={state.categoryRefreshError}
        onRetryCategoryRefresh={refreshCategories}
        onWritePending={updateWritePending}
        navigationError={navigationError}
          onRetryNavigation={retryNavigation}
          returnLabel={returnRoute.label}
          onDone={queueNavigation}
      />
    );
  }
  return <TransactionRouteView state={state} returnRoute={returnRoute} />;
}
