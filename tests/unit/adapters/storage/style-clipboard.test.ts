// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  COPIED_STYLE_KEY,
  readCopiedStyle,
  writeCopiedStyle,
} from '../../../../src/adapters/storage/style-clipboard';

afterEach(() => localStorage.removeItem(COPIED_STYLE_KEY));

describe('copied note style', () => {
  it('keeps a copied style, leaving out fields the source never set', () => {
    expect(readCopiedStyle()).toBeNull();
    writeCopiedStyle({ color: 'blue', bold: true, textAlign: 'left', fontSize: 32 });
    expect(readCopiedStyle()).toEqual({
      color: 'blue',
      bold: true,
      textAlign: 'left',
      fontSize: 32,
    });
  });

  it.each([
    'not json',
    'null',
    '[]',
    JSON.stringify({ color: 'chartreuse' }),
    JSON.stringify({ color: 'blue', fontSize: 9999 }),
    JSON.stringify({ color: 'blue', bold: 'yes' }),
  ])('ignores a stored style it cannot trust: %s', (stored) => {
    localStorage.setItem(COPIED_STYLE_KEY, stored);
    expect(readCopiedStyle()).toBeNull();
  });

  it('drops fields that are not part of a style', () => {
    localStorage.setItem(
      COPIED_STYLE_KEY,
      JSON.stringify({ color: 'pink', locked: true, groupId: 'g', text: 'secret' }),
    );
    expect(readCopiedStyle()).toEqual({ color: 'pink' });
  });
});
