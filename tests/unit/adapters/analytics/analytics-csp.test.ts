import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyticsCsp, withAnalyticsSources } from '../../../../scripts/analytics-csp';

const html = readFileSync('index.html', 'utf8');
const policyOf = (page: string) =>
  /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(page)![1];
const directive = (policy: string, name: string) =>
  policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));

const transform = (id: string | undefined) => {
  const hook = analyticsCsp(id).transformIndexHtml as (html: string) => string;
  return hook(html);
};

describe('analytics content security policy', () => {
  it('keeps the strict policy in a build without a measurement ID', () => {
    expect(transform(undefined)).toBe(html);
    expect(transform('  ')).toBe(html);
    expect(policyOf(html)).not.toContain('google-analytics');
  });

  it('opens only the Google Analytics origins, and never inline scripts or eval', () => {
    const before = policyOf(html);
    const after = policyOf(transform('G-518PHP5LCZ'));
    expect(after).toBe(withAnalyticsSources(before));
    expect(directive(after, 'script-src')).toBe(
      `${directive(before, 'script-src')} https://www.googletagmanager.com`,
    );
    expect(directive(after, 'connect-src')).toContain('https://*.google-analytics.com');
    expect(directive(after, 'img-src')).toContain('https://*.google-analytics.com');
    expect(directive(after, 'default-src')).toBe(directive(before, 'default-src'));
    expect(after).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline/);
  });
});
