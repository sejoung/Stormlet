import { describe, expect, it } from 'vitest';
import {
  fitNoteFont,
  MIN_FITTED_FONT,
  MIN_NOTE_FONT,
  NOTE_PADDING,
  NOTE_LINE_HEIGHT,
} from '../../../src/engine/text-fit';

const size = { width: 160, height: 120 };

describe('note text fitting', () => {
  it('fills short notes and shrinks for longer Korean, Latin and emoji text', () => {
    const short = fitNoteFont('아이디어', size);
    expect(short).toBeGreaterThan(24);
    for (const text of [
      '새로 떠오른 아이디어를 포스트잇에 정리해 봅니다.',
      'A longer idea that needs to wrap over several lines.',
      '🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉',
    ])
      expect(fitNoteFont(text, size)).toBeLessThan(short);
  });

  it('uses the note dimensions and honors explicit newlines', () => {
    const text = '확인할 내용과 다음에 할 일';
    expect(fitNoteFont(text, { width: 320, height: 240 })).toBeGreaterThan(fitNoteFont(text, size));
    expect(fitNoteFont('A\nB\nC\nD\nE', size)).toBeLessThan(fitNoteFont('ABCDE', size));
  });

  it('uses actual rendered measurements when provided instead of estimating character count', () => {
    const actualLimit = Math.min(
      (size.width - NOTE_PADDING * 2) / 5,
      (size.height - NOTE_PADDING * 2) / (3 * NOTE_LINE_HEIGHT),
    );
    const result = fitNoteFont('실제 글꼴의 줄바꿈', size, (font) => font <= actualLimit);
    expect(result).toBeLessThanOrEqual(actualLimit);
    expect(result).toBeGreaterThan(actualLimit - 1);
  });

  it('keeps shrinking below the chosen-size minimum so long text never scrolls', () => {
    const font = fitNoteFont('매우 긴 메모 '.repeat(500), size);
    expect(font).toBeLessThan(MIN_NOTE_FONT);
    expect(font).toBeGreaterThanOrEqual(MIN_FITTED_FONT);
    const limit = 3.33;
    expect(fitNoteFont('긴 메모', size, (f) => f <= limit)).toBe(3.3);
  });

  it('steps in half pixels at readable sizes and returns the floor when nothing fits', () => {
    expect(fitNoteFont('메모', size, (font) => font <= 17.7)).toBe(17.5);
    expect(fitNoteFont('메모', size, () => false)).toBe(MIN_FITTED_FONT);
  });
});
