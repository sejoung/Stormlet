import { useEffect, useRef, useState } from 'react';
import type { DriveAuth } from '../../adapters/drive/types';
import { errorDetails, log } from '../../adapters/diagnostics/log';
import { useLatest } from '../../components/common/useStableCallback';
import { useT } from '../../components/common/i18n';

/**
 * Renew Drive access before it runs out (ADR 0010). Google's token model has no refresh
 * token and its popup needs a user gesture, so while the token is in its renewal window
 * the next click anywhere renews it; for a user who already agreed the popup closes by
 * itself. Keys are left alone, since the popup would take focus mid-typing. After a failed
 * attempt only the Drive button renews, so a closed or blocked popup is not reopened on
 * every click.
 */
export function useAuthRenewal(
  auth: DriveAuth | undefined,
  /** Whether a file is being synced, so access is worth keeping. */
  active: boolean,
  onStatus: (message: string) => void,
) {
  const t = useT();
  const [expiring, setExpiring] = useState(() => Boolean(auth?.expiring()));
  const [automatic, setAutomatic] = useState(true);
  const renewing = useRef(false);
  /** Set at once on failure, before the click listener is gone, so no click retries. */
  const stopped = useRef(false);

  const renew = async (manual: boolean) => {
    if (!auth || renewing.current || !auth.expiring() || (stopped.current && !manual)) return;
    renewing.current = true;
    try {
      await auth.connect();
      log.info('drive.renewed', { manual });
    } catch (error) {
      stopped.current = true;
      setAutomatic(false);
      log.warn('drive.renew-failed', { manual, ...errorDetails(error, false) });
      if (manual) onStatus(t('drive.renewFailed'));
    } finally {
      renewing.current = false;
      setExpiring(auth.expiring());
    }
  };
  const latest = useLatest(renew);

  useEffect(() => {
    if (!auth) return;
    return auth.subscribe((event) => {
      setExpiring(auth.expiring());
      // A new token, an expiry or a disconnect starts over with automatic renewal allowed.
      if (event === 'expiring') return;
      stopped.current = false;
      setAutomatic(true);
    });
  }, [auth]);

  useEffect(() => {
    if (!expiring || !automatic || !active) return;
    const click = (event: MouseEvent) => {
      // The Drive button renews by itself and reports its own failure.
      if (event.target instanceof Element && event.target.closest('.drive-renew')) return;
      void latest.current(false);
    };
    window.addEventListener('click', click, true);
    return () => window.removeEventListener('click', click, true);
  }, [expiring, automatic, active, latest]);

  return { expiring: expiring && active, renew: () => void renew(true) };
}
