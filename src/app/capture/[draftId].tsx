/** Native capture route with route-owned draft identity and camera lifetime. */
import { useCameraPermissions } from 'expo-camera';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCaptureLedgerData } from '../../ui/ledger-access';
import { Button } from '../../ui/Button';
import {
  CaptureScreen,
  type CapturePermission,
} from '../../ui/capture/CaptureScreen';
import {
  parseCaptureRoute,
  resolveCaptureRoute,
  type ParsedCaptureRoute,
} from '../../ui/capture/capture-route';
import { useNativeCaptureCamera } from './camera-adapter';
import {
  discardPreparedPhoto,
  preparePhoto,
  retainPhoto,
} from '../../photos/photo-access';

type RouteState =
  | ParsedCaptureRoute
  | { status: 'loading' }
  | { status: 'new' }
  | { status: 'saved' }
  | { status: 'collision'; message: string }
  | { status: 'error'; message: string };

function parameterKey(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join('\u0000') : value ?? '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toPermission(
  permission: ReturnType<typeof useCameraPermissions>[0],
  request: () => Promise<unknown>,
  refresh: () => Promise<unknown>
): CapturePermission {
  if (permission === null) return { status: 'loading' };
  if (permission.granted) return { status: 'granted', refresh };
  if (permission.status === 'undetermined') return { status: 'undetermined', request };
  return {
    status: 'denied',
    canAskAgain: permission.canAskAgain,
    request,
    openSettings: () => Linking.openSettings(),
    refresh,
  };
}

function navigateHome(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/' as Href);
  }
}

export default function CaptureRoute({
  data = getCaptureLedgerData(),
  camera: injectedCamera,
  permission: injectedPermission,
}: {
  data?: ReturnType<typeof getCaptureLedgerData>;
  camera?: Parameters<typeof CaptureScreen>[0]['camera'];
  permission?: CapturePermission;
}) {
  const { draftId: draftIdParam } = useLocalSearchParams<{
    draftId?: string | string[];
  }>();
  const routeKey = parameterKey(draftIdParam);
  const parsed = useMemo(() => parseCaptureRoute(draftIdParam), [routeKey]);
  const [routeState, setRouteState] = useState<RouteState>(() =>
    parsed.status === 'invalid' ? parsed : { status: 'loading' }
  );
  const [terminalPending, setTerminalPending] = useState(false);
  const [focused, setFocused] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const requestRef = useRef(0);
  const mountedRef = useRef(false);
  const savedNavigationAttemptedRef = useRef(false);
  const nativeCamera = useNativeCaptureCamera();
  const [permissionResponse, requestPermission, refreshPermission] = useCameraPermissions();
  const request = useCallback(() => requestPermission(), [requestPermission]);
  const refresh = useCallback(() => refreshPermission(), [refreshPermission]);
  const permission = useMemo(
    () => injectedPermission ?? toPermission(permissionResponse, request, refresh),
    [injectedPermission, permissionResponse, request, refresh]
  );

  usePreventRemove(terminalPending, () => undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    const requestNumber = requestRef.current + 1;
    requestRef.current = requestNumber;
    savedNavigationAttemptedRef.current = false;
    if (parsed.status === 'invalid') {
      setRouteState(parsed);
      return;
    }

    setRouteState({ status: 'loading' });
    void data.readTransaction(parsed.draftId)
      .then((transaction) => {
        if (!mountedRef.current || requestNumber !== requestRef.current) return;
        const resolution = resolveCaptureRoute(transaction);
        if (resolution.status === 'new') {
          setRouteState({ status: 'new' });
        } else if (resolution.status === 'saved') {
          setRouteState({ status: 'saved' });
        } else {
          setRouteState({ status: 'collision', message: resolution.message });
        }
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || requestNumber !== requestRef.current) return;
        setRouteState({ status: 'error', message: errorMessage(error) });
      });
  }, [data, parsed, routeKey]);

  useEffect(() => {
    if (routeState.status !== 'saved' || savedNavigationAttemptedRef.current) return;
    savedNavigationAttemptedRef.current = true;
    try {
      navigateHome();
    } catch (error: unknown) {
      savedNavigationAttemptedRef.current = false;
      setRouteState({ status: 'error', message: errorMessage(error) });
    }
  }, [routeState]);

  const retryRoute = useCallback(() => {
    if (parsed.status !== 'valid') return;
    const requestNumber = requestRef.current + 1;
    requestRef.current = requestNumber;
    setRouteState({ status: 'loading' });
    void data.readTransaction(parsed.draftId)
      .then((transaction) => {
        if (!mountedRef.current || requestNumber !== requestRef.current) return;
        const resolution = resolveCaptureRoute(transaction);
        if (resolution.status === 'new') setRouteState({ status: 'new' });
        else if (resolution.status === 'saved') setRouteState({ status: 'saved' });
        else setRouteState({ status: 'collision', message: resolution.message });
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || requestNumber !== requestRef.current) return;
        setRouteState({ status: 'error', message: errorMessage(error) });
      });
  }, [data, parsed]);

  if (routeState.status === 'invalid') {
    return <RouteMessage title="Invalid capture link" detail={routeState.message} />;
  }
  if (routeState.status === 'loading') {
    return <RouteMessage title="Capture" detail="Checking this capture link…" />;
  }
  if (routeState.status === 'collision') {
    return <RouteMessage title="Capture link unavailable" detail={routeState.message} />;
  }
  if (routeState.status === 'error') {
    return (
      <RouteMessage
        title="Capture could not load"
        detail={routeState.message}
        action={<Button onPress={retryRoute}>Try again</Button>}
      />
    );
  }
  if (routeState.status === 'saved') {
    return (
      <RouteMessage
        title="Capture already saved"
        detail="This purchase draft is already durable."
        action={<Button onPress={() => navigateHome()}>Back to home</Button>}
      />
    );
  }

  return (
    <CaptureScreen
      key={parsed.status === 'valid' ? parsed.draftId : routeKey}
      draftId={parsed.status === 'valid' ? parsed.draftId : routeKey}
      camera={injectedCamera ?? nativeCamera}
      permission={permission}
      photos={{ preparePhoto, retainPhoto, discardPreparedPhoto }}
      createCapturedDraft={data.createCapturedDraft}
      readTransaction={data.readTransaction}
      isFocused={focused}
      isAppActive={appActive}
      onCancel={navigateHome}
      onNavigateHome={navigateHome}
      onTerminalPending={setTerminalPending}
    />
  );
}

function RouteMessage({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 gap-3 bg-ground-light px-5 py-16 dark:bg-ground-dark">
      <View className="gap-3">
        <Text className="text-eyebrow font-semibold tracking-widest text-need-light dark:text-need-dark">
          CARRYOVER · CAPTURE
        </Text>
        <Text accessibilityRole="header" className="text-title font-bold text-ink-light dark:text-ink-dark">
          {title}
        </Text>
        <Text className="text-body text-muted-light dark:text-muted-dark" selectable>
          {detail}
        </Text>
        {action ?? <Button variant="secondary" onPress={navigateHome}>Back to home</Button>}
      </View>
    </SafeAreaView>
  );
}
