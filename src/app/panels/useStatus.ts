import { useEffect, useState } from 'react';

/** How long a status message stays before it clears itself. */
export const STATUS_DURATION = 5000;

/** The toolbar's status message, which clears itself after `STATUS_DURATION`. */
export function useStatus() {
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), STATUS_DURATION);
    return () => window.clearTimeout(timer);
  }, [status]);
  return [status, setStatus] as const;
}
