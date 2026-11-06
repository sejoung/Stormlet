// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  CREATION_DEFAULTS_KEY,
  readCreationDefaults,
  writeCreationDefaults,
} from '../../../src/adapters/storage/creation-defaults';

afterEach(() => localStorage.removeItem(CREATION_DEFAULTS_KEY));

describe('creation defaults', () => {
  it('defaults to yellow notes and elbow arrows and persists a complete valid preference', () => {
    expect(readCreationDefaults()).toMatchObject({
      stickyColor: 'yellow',
      connection: { path: 'elbow', color: 'slate', endArrow: true },
    });
    const defaults = {
      ...readCreationDefaults(),
      stickyColor: 'blue' as const,
      connection: {
        path: 'curve' as const,
        color: 'purple' as const,
        width: 4,
        startArrow: true,
        endArrow: false,
        dashed: true,
      },
    };
    writeCreationDefaults(defaults);
    expect(readCreationDefaults()).toStrictEqual(defaults);
  });

  it.each([
    '{',
    'null',
    '42',
    JSON.stringify({
      stickyColor: 'unknown',
      connection: {
        path: 'unknown',
        color: 'unknown',
        width: -1,
        startArrow: 'yes',
        endArrow: 1,
        dashed: null,
      },
    }),
  ])('ignores invalid stored defaults %s', (value) => {
    const expected = readCreationDefaults();
    localStorage.setItem(CREATION_DEFAULTS_KEY, value);
    expect(readCreationDefaults()).toStrictEqual(expected);
  });

  it('keeps a valid color even if no connection settings were stored', () => {
    localStorage.setItem(CREATION_DEFAULTS_KEY, JSON.stringify({ stickyColor: 'teal' }));
    expect(readCreationDefaults()).toMatchObject({
      stickyColor: 'teal',
      connection: { path: 'elbow', endArrow: true },
    });
  });
});
