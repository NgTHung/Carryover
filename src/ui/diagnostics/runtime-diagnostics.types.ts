export type SigningFacts = {
  bundleIdentifier: string;
  configuredAppGroup: string;
  resolvedAppGroup: string;
  grantedAppGroups: string[];
  grantedAppGroupsResolving: string[];
  containerPath: string;
  profileFound: boolean;
  profileName: string;
  teamIdentifier: string;
  entitlementKeys: string[];
  entitlements: Record<string, string>;
};

export type WidgetPushResult =
  | { status: 'pushed'; timelineEntries: number }
  | { status: 'unavailable'; reason: string };
