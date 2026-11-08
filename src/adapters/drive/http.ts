import { RemoteError, type RemoteFailure } from '../../domain/sync/remote';

/** 403 reasons that mean "slow down" rather than "not allowed": retried like network failures. */
const RATE_LIMITS = ['rateLimitExceeded', 'userRateLimitExceeded', 'sharingRateLimitExceeded'];
/** 403 reasons that mean the owner's Drive has no room for the file. */
const FULL = ['storageQuotaExceeded', 'quotaExceeded'];

const STATUS_FAILURES: Record<number, RemoteFailure> = {
  401: 'auth',
  403: 'permission',
  404: 'missing',
  409: 'conflict',
  412: 'conflict',
};

/** The failure for a refused request; 403 covers several, told apart by Google's reason. */
export async function failureOf(response: Response): Promise<RemoteError> {
  const status = `Drive answered ${response.status}`;
  if (response.status !== 403)
    return new RemoteError(STATUS_FAILURES[response.status] ?? 'network', `${status}.`);
  const body = (await response.json().catch(() => null)) as {
    error?: { errors?: { reason?: unknown }[] };
  } | null;
  const reason = String(body?.error?.errors?.[0]?.reason ?? '');
  const failure = RATE_LIMITS.includes(reason)
    ? 'network'
    : FULL.includes(reason)
      ? 'full'
      : 'permission';
  return new RemoteError(failure, reason ? `${status} (${reason}).` : `${status}.`);
}

export function multipart(metadata: object, content: string) {
  const boundary = `stormlet-${crypto.randomUUID()}`;
  return {
    type: `multipart/related; boundary=${boundary}`,
    body:
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      `${content}\r\n--${boundary}--`,
  };
}
