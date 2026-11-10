// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_KEY,
  GTAG_URL,
  GoogleAnalytics,
  MAX_ERROR_EVENTS,
} from '../../../../src/adapters/analytics/google-analytics';
import { analyticsConfig } from '../../../../src/adapters/analytics/config';
import { log } from '../../../../src/adapters/diagnostics/log';

const ID = 'G-TEST1234';

/** A page of its own for each instance, so earlier instances cannot reach its data layer. */
type Page = Window & { dataLayer?: IArguments[] } & Record<string, unknown>;
const page = () => {
  const target = new EventTarget();
  return Object.assign(target, { location: window.location, document }) as unknown as Page;
};
/** What a page hears when another tab changes the stored choice. */
const otherTab = (target: Page, consent: string | null) => {
  if (consent) localStorage.setItem(CONSENT_KEY, consent);
  else localStorage.removeItem(CONSENT_KEY);
  target.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY, newValue: consent }));
};

/** What the page sent through gtag, as plain arrays. */
const calls = (target: Page) => (target.dataLayer ?? []).map((args) => [...args]);
const events = (target: Page) => calls(target).filter(([command]) => command === 'event');
const tags = () => document.head.querySelectorAll(`script[src^="${GTAG_URL}"]`);

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.head.innerHTML = '';
});

describe('analytics configuration', () => {
  it('reads a measurement ID and builds without one that is missing or malformed', () => {
    expect(analyticsConfig({ PROD: true, VITE_GA_MEASUREMENT_ID: ' G-518PHP5LCZ ' })).toEqual({
      measurementId: 'G-518PHP5LCZ',
    });
    for (const value of [undefined, '', 'GTM-N42X3TFG', 'UA-1234-1', 'G-<script>'])
      expect(analyticsConfig({ PROD: true, VITE_GA_MEASUREMENT_ID: value })).toBeNull();
  });

  it('is off outside production builds, such as on the dev server', () => {
    for (const PROD of [false, undefined])
      expect(analyticsConfig({ PROD, VITE_GA_MEASUREMENT_ID: 'G-518PHP5LCZ' })).toBeNull();
  });
});

describe('Google Analytics', () => {
  it('loads and sends nothing until the user decides', () => {
    const target = page();
    const stats = new GoogleAnalytics(ID, target);
    log.info('files.downloaded');
    expect(stats.consent).toBeNull();
    expect(target.dataLayer).toBeUndefined();
    expect(tags()).toHaveLength(0);

    stats.choose('denied');
    log.info('files.downloaded');
    expect(target.dataLayer).toBeUndefined();
    expect(tags()).toHaveLength(0);
    expect(localStorage.getItem(CONSENT_KEY)).toBe('denied');
    // The choice is remembered by the next page load.
    expect(new GoogleAnalytics(ID, page()).consent).toBe('denied');
  });

  it('starts once allowed, without ads, Google signals or the address hash', () => {
    const target = page();
    window.history.replaceState(null, '', '/Stormlet/?board=x#new=Secret');
    new GoogleAnalytics(ID, target).choose('granted');
    window.history.replaceState(null, '', '/');
    expect(tags()).toHaveLength(1);
    expect(tags()[0].getAttribute('src')).toBe(`${GTAG_URL}?id=${ID}`);
    const config = calls(target).find(([command]) => command === 'config');
    expect(config).toEqual([
      'config',
      ID,
      {
        page_location: `${window.location.origin}/Stormlet/`,
        page_title: 'Stormlet',
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      },
    ]);
    expect(calls(target)[0]).toEqual([
      'consent',
      'default',
      expect.objectContaining({ analytics_storage: 'granted', ad_storage: 'denied' }),
    ]);
    // A later page load starts straight away.
    const next = page();
    new GoogleAnalytics(ID, next);
    expect(calls(next).some(([command]) => command === 'config')).toBe(true);
  });

  it('sends listed features with code-word details only, and error names', () => {
    const target = page();
    new GoogleAnalytics(ID, target).choose('granted');
    log.info('files.exported', { format: 'png' });
    log.info('files.exported', { format: 'my secret plan' });
    log.info('files.opened', { size: 120 });
    log.info('store.loaded', { notes: 3 });
    log.warn('files.open-failed', { message: 'Note text' });
    log.error('store.save-failed', { message: 'Note text' });
    expect(events(target)).toEqual([
      ['event', 'image_exported', { format: 'png' }],
      ['event', 'image_exported', {}],
      ['event', 'file_opened', {}],
      ['event', 'app_error', { error_event: 'store.save-failed' }],
    ]);
  });

  it(`sends at most ${MAX_ERROR_EVENTS} errors per page load`, () => {
    const target = page();
    new GoogleAnalytics(ID, target).choose('granted');
    for (let index = 0; index < MAX_ERROR_EVENTS + 5; index++) log.error('uncaught.error');
    log.info('files.downloaded');
    expect(events(target)).toHaveLength(MAX_ERROR_EVENTS + 1);
    expect(events(target).at(-1)).toEqual(['event', 'file_downloaded', {}]);
  });

  it('stops sending and removes its cookies when declined, and resumes when allowed', () => {
    const target = page();
    const stats = new GoogleAnalytics(ID, target);
    stats.choose('granted');
    document.cookie = '_ga=GA1.1.123; path=/';
    document.cookie = `_ga_${ID.slice(2)}=GS1.1.456; path=/`;
    document.cookie = 'other=kept; path=/';

    stats.choose('denied');
    log.info('files.downloaded');
    expect(events(target)).toHaveLength(0);
    expect(target[`ga-disable-${ID}`]).toBe(true);
    expect(calls(target).at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    expect(document.cookie).toBe('other=kept');

    stats.choose('granted');
    log.info('files.downloaded');
    expect(target[`ga-disable-${ID}`]).toBe(false);
    expect(events(target)).toEqual([['event', 'file_downloaded', {}]]);
    expect(tags()).toHaveLength(1);
    document.cookie = 'other=; Max-Age=0; path=/';
  });

  it('follows a choice made in another tab', () => {
    const target = page();
    const stats = new GoogleAnalytics(ID, target);
    otherTab(target, 'granted');
    expect(stats.consent).toBe('granted');
    expect(tags()).toHaveLength(1);
    document.cookie = '_ga=GA1.1.123; path=/';

    otherTab(target, 'denied');
    log.info('files.downloaded');
    expect(stats.consent).toBe('denied');
    expect(events(target)).toHaveLength(0);
    expect(target[`ga-disable-${ID}`]).toBe(true);
    expect(calls(target).at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    expect(document.cookie).toBe('');

    // A tab whose refusal could not be stored leaves no choice; that sends nothing too.
    otherTab(target, 'granted');
    otherTab(target, null);
    log.info('files.downloaded');
    expect(stats.consent).toBeNull();
    expect(events(target)).toHaveLength(0);
  });

  it('forgets an earlier agreement when a refusal cannot be stored', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    const stats = new GoogleAnalytics(ID, page());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    stats.choose('denied');
    expect(stats.consent).toBe('denied');
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull();
    expect(new GoogleAnalytics(ID, page()).consent).toBeNull();
  });
});
