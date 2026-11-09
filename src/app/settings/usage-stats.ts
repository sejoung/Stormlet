import { createContext, useContext, useState } from 'react';
import type { Consent, UsageStats } from '../../adapters/analytics/google-analytics';

/** The user's choice about usage statistics, and a way to change it. */
export interface UsageStatsChoice {
  consent: Consent | null;
  choose(consent: Consent): void;
}

const UsageStatsContext = createContext<UsageStatsChoice | null>(null);

/** Provides the choice to the consent banner and the settings menu. */
export const UsageStatsProvider = UsageStatsContext.Provider;

/** The choice, for a build with usage statistics; null for one without them. */
export function useUsageStatsChoice(stats: UsageStats | undefined): UsageStatsChoice | null {
  const [consent, setConsent] = useState(() => stats?.consent ?? null);
  if (!stats) return null;
  return {
    consent,
    choose: (next) => {
      stats.choose(next);
      setConsent(next);
    },
  };
}

/** The choice provided above; null where the build has no usage statistics. */
export const useUsageStats = (): UsageStatsChoice | null => useContext(UsageStatsContext);
