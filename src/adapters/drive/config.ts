/** Public browser configuration for Google Drive; never a client secret. */
export interface GoogleConfig {
  clientId: string;
  apiKey: string;
  appId: string;
}

/**
 * The Drive settings of this build (`.env.local`, see docs/google-drive.md), or null when
 * any is missing: Drive is optional and the app works fully without it.
 */
export function driveConfig(
  env: Record<string, string | undefined> = import.meta.env,
): GoogleConfig | null {
  const clientId = env.VITE_GOOGLE_CLIENT_ID?.trim();
  const apiKey = env.VITE_GOOGLE_API_KEY?.trim();
  const appId = env.VITE_GOOGLE_APP_ID?.trim();
  return clientId && apiKey && appId ? { clientId, apiKey, appId } : null;
}
