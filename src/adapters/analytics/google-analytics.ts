import { onLogEntry, type LogEntry } from '../diagnostics/log';
import { readItem, writeItem } from '../storage/web-storage';
import { usageEvent } from './usage-events';

/** localStorage: whether the user agreed to send usage statistics (`granted` or `denied`). */
export const CONSENT_KEY = 'stormlet.usage-stats';
/** Google's tag library; it loads only after the user agrees. */
export const GTAG_URL = 'https://www.googletagmanager.com/gtag/js';
/** Errors sent per page load, so one failing in a loop cannot flood the statistics. */
export const MAX_ERROR_EVENTS = 20;

export type Consent = 'granted' | 'denied';

/** Usage statistics the user can agree to or decline; undecided (null) sends nothing. */
export interface UsageStats {
  readonly consent: Consent | null;
  choose(consent: Consent): void;
}

type Gtag = (...args: unknown[]) => void;
type TaggedWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag } & Record<string, unknown>;

const readConsent = (): Consent | null => {
  const stored = readItem(CONSENT_KEY);
  return stored === 'granted' || stored === 'denied' ? stored : null;
};

/** Expire Google Analytics' cookies on this host and each domain above it. */
function removeCookies(document: Document, measurementId: string) {
  const labels = document.location.hostname.split('.');
  const domains = ['', ...labels.map((_, index) => `; domain=${labels.slice(index).join('.')}`)];
  for (const name of ['_ga', `_ga_${measurementId.slice(2)}`])
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
}

/**
 * Usage statistics through Google Analytics 4 (ADR 0014). Nothing is loaded or sent until
 * the user agrees; then page views, the features listed in `usage-events` and the names of
 * errors are sent, with Google signals and ad personalisation off. Declining later stops
 * sending and removes the Analytics cookies. The choice is kept in this browser.
 */
export class GoogleAnalytics implements UsageStats {
  #consent: Consent | null = readConsent();
  #started = false;
  #errors = 0;

  constructor(
    private readonly measurementId: string,
    private readonly page: Window = window,
  ) {
    if (this.#consent === 'granted') this.#start();
    onLogEntry((entry) => this.#forward(entry));
  }

  get consent(): Consent | null {
    return this.#consent;
  }

  choose(consent: Consent): void {
    writeItem(CONSENT_KEY, consent);
    this.#consent = consent;
    const page = this.page as TaggedWindow;
    // Google's own switch, honoured by a tag already running in this page.
    page[`ga-disable-${this.measurementId}`] = consent === 'denied';
    if (consent === 'denied') {
      if (this.#started) this.#gtag('consent', 'update', { analytics_storage: 'denied' });
      removeCookies(page.document, this.measurementId);
    } else if (this.#started) this.#gtag('consent', 'update', { analytics_storage: 'granted' });
    else this.#start();
  }

  #gtag(...args: unknown[]) {
    (this.page as TaggedWindow).gtag?.(...args);
  }

  #start() {
    this.#started = true;
    const page = this.page as TaggedWindow;
    page.dataLayer = page.dataLayer ?? [];
    const layer = page.dataLayer;
    page.gtag = function gtag() {
      // gtag.js reads the `arguments` objects themselves from the data layer, not arrays.
      // eslint-disable-next-line prefer-rest-params
      layer.push(arguments);
    };
    const { origin, pathname } = page.location;
    this.#gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    this.#gtag('js', new Date());
    this.#gtag('config', this.measurementId, {
      // The address without its hash or query: those can carry a board's title.
      page_location: `${origin}${pathname}`,
      page_title: 'Stormlet',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const script = page.document.createElement('script');
    script.async = true;
    script.src = `${GTAG_URL}?id=${encodeURIComponent(this.measurementId)}`;
    page.document.head.append(script);
  }

  #forward(entry: LogEntry) {
    if (!this.#started || this.#consent !== 'granted') return;
    const event = usageEvent(entry);
    if (!event) return;
    if (event.name === 'app_error' && ++this.#errors > MAX_ERROR_EVENTS) return;
    this.#gtag('event', event.name, event.params);
  }
}
