import { describe, expect, it } from 'vitest';
import { freeName, isNameFor, numberedName } from '../../../src/adapters/files/file-names';

describe('file names', () => {
  it('numbers copies before the extension, as file managers do', () => {
    expect(numberedName('Plan.stormlet', 1)).toBe('Plan.stormlet');
    expect(numberedName('Plan.stormlet', 3)).toBe('Plan (3).stormlet');
    expect(freeName('Plan.stormlet', new Set())).toBe('Plan.stormlet');
    expect(freeName('Plan.stormlet', new Set(['Plan.stormlet', 'Plan (2).stormlet']))).toBe(
      'Plan (3).stormlet',
    );
    // A gap is filled first.
    expect(freeName('Plan.stormlet', new Set(['Plan.stormlet', 'Plan (3).stormlet']))).toBe(
      'Plan (2).stormlet',
    );
  });

  it('knows a numbered copy belongs to its title, even with special characters', () => {
    expect(isNameFor('Plan (12).stormlet', 'Plan.stormlet')).toBe(true);
    expect(isNameFor('Plan.stormlet', 'Plan.stormlet')).toBe(true);
    expect(isNameFor('Plan (x).stormlet', 'Plan.stormlet')).toBe(false);
    expect(isNameFor('Planning (2).stormlet', 'Plan.stormlet')).toBe(false);
    expect(isNameFor('a+b (2).stormlet', 'a+b.stormlet')).toBe(true);
    expect(isNameFor('aab (2).stormlet', 'a+b.stormlet')).toBe(false);
  });
});
