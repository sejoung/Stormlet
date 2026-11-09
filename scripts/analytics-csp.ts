import type { Plugin } from 'vite';

/**
 * The origins Google Analytics 4 needs (Google's CSP guide, without Google signals), by
 * directive. The policy keeps refusing inline scripts and `eval`.
 */
export const ANALYTICS_SOURCES: Readonly<Record<string, readonly string[]>> = {
  'script-src': ['https://www.googletagmanager.com'],
  'img-src': ['https://*.google-analytics.com', 'https://*.googletagmanager.com'],
  'connect-src': [
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.googletagmanager.com',
  ],
};

/** `policy` with the Google Analytics origins added to the directives that need them. */
export function withAnalyticsSources(policy: string): string {
  return policy
    .split(';')
    .map((directive) => {
      const name = directive.trim().split(/\s+/)[0];
      const sources = ANALYTICS_SOURCES[name];
      return sources ? `${directive.trimEnd()} ${sources.join(' ')}` : directive;
    })
    .join(';');
}

const CSP_META = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/;

/**
 * Opens the page's Content Security Policy to Google Analytics, only in a build that sends
 * usage statistics (`measurementId` set); other builds, and the dev server, which never
 * sends them, keep the stricter policy.
 */
export function analyticsCsp(measurementId: string | undefined): Plugin {
  return {
    name: 'stormlet-analytics-csp',
    apply: 'build',
    transformIndexHtml(html) {
      if (!measurementId?.trim()) return html;
      if (!CSP_META.test(html)) throw new Error('index.html has no Content-Security-Policy');
      return html.replace(
        CSP_META,
        (_, start: string, policy: string, end: string) =>
          `${start}${withAnalyticsSources(policy)}${end}`,
      );
    },
  };
}
