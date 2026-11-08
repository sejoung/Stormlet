/** A Drive file or folder as the user picked it. */
export interface DriveItem {
  id: string;
  name: string;
}

export type PickKind = 'file' | 'folder';

export interface PickOptions {
  /** Picker interface language, such as `en`. */
  language: string;
  /** Already translated: adapters hold no interface text. */
  title: string;
}

/** Google sign-in and the Drive Picker; `GoogleConnection` implements them. */
export interface DriveAuth {
  /** A usable access token, or null when not connected or expired. */
  getToken(): string | null;
  /** Called when the connection starts or ends (including expiry); returns an unsubscribe. */
  subscribe(listener: (connected: boolean) => void): () => void;
  /** Load Google's scripts; done ahead, because the sign-in popup needs a fresh user gesture. */
  prepare(): Promise<void>;
  /** Whether `prepare` has finished, so `connect` can open its popup at once. */
  ready(): boolean;
  /** Ask for access in Google's popup; call it straight from a click. */
  connect(): Promise<void>;
  /** Show the Picker; resolves with the chosen item, or null when cancelled. */
  pick(kind: PickKind, options: PickOptions): Promise<DriveItem | null>;
  /** Forget the token and withdraw Google's consent. */
  disconnect(): Promise<void>;
}

/** Errors Google sign-in reports, by what the user can do about them. */
export type AuthFailure = 'unavailable' | 'cancelled' | 'revoke';

export class DriveAuthError extends Error {
  constructor(
    readonly reason: AuthFailure,
    message: string = reason,
  ) {
    super(message);
    this.name = 'DriveAuthError';
  }
}
