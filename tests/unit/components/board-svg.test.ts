import { describe, expect, it } from 'vitest';
import { boardSvg } from '../../../src/components/export/board-svg';
import { layoutNote, scaledMeasure, wrapText } from '../../../src/components/export/text-layout';
import { boardOf, sticky } from '../../support/boards';
import { frame } from '../../support/frames';
import { connection } from '../../support/connections';

/** Every character is as wide as half the font size: a stand-in for real font metrics. */
const measure = (text: string, font: string) =>
  [...text].length * Number(/(\d+(?:\.\d+)?)px/.exec(font)![1]) * 0.5;
const tenPx = (text: string) => [...text].length * 10;

describe('standalone text export', () => {
  it('draws escaped, top-aligned text in its ink color, without a paper rectangle or shadow', () => {
    const board = boardOf(
      sticky('text', {
        objectType: 'text',
        text: '<hello>\nworld',
        textColor: 'blue',
        fontSize: 24,
        autoFont: false,
        width: 320,
        height: 200,
        x: 100,
        y: 200,
        bold: true,
      }),
    );
    const result = boardSvg(board, measure)!;
    expect(result.svg).toContain('&lt;hello&gt;');
    expect(result.svg).not.toContain('<hello>');
    expect(result.svg).toContain('fill="#4262e8" text-anchor="start" font-weight="700"');
    expect(result.svg).not.toContain('filter="url(#note-shadow)"');
    expect(result.svg.match(/<rect /g)).toHaveLength(1);
    expect(result.svg).toContain('<text x="104" y="226.2">');
  });
});

describe('note text layout', () => {
  it('wraps at spaces, between CJK characters, and inside a word only when it must', () => {
    expect(wrapText('one two three', 70, tenPx)).toEqual(['one two', 'three']);
    expect(wrapText('가나다라마바', 40, tenPx)).toEqual(['가나다라', '마바']);
    expect(wrapText('abcdefghij', 40, tenPx)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrapText('a\n\nb', 100, tenPx)).toEqual(['a', '', 'b']);
    expect(wrapText('go 가나다', 50, tenPx)).toEqual(['go 가나', '다']);
  });

  it('fits the font like the editor, keeping a chosen size only while the text fits', () => {
    const measureAt = scaledMeasure(measure);
    const auto = layoutNote(sticky('a', { text: 'hi', width: 160, height: 160 }), measureAt);
    expect(auto.lines).toEqual(['hi']);
    expect(auto.size).toBeGreaterThan(60);
    const chosen = sticky('b', { text: 'hi', autoFont: false, fontSize: 18 });
    expect(layoutNote(chosen, measureAt).size).toBe(18);
    const long = sticky('c', { text: 'word '.repeat(40), autoFont: false, fontSize: 48 });
    expect(layoutNote(long, measureAt).size).toBeLessThan(48);
  });
});

describe('board SVG', () => {
  it('draws frames, then lines, then notes on a white page around the content', () => {
    const board = {
      ...boardOf(
        sticky('a', { text: 'A & <B>', textAlign: 'left', bold: true, underline: true }),
        sticky('b', { x: 400, color: 'pink', reactions: [{ emoji: '👍', people: ['x'] }] }),
      ),
      frames: { f: frame('f', { x: -40, y: -40, width: 300, height: 220, title: 'Q"1' }) },
      connections: { line: connection('line', { color: 'black', label: 'go', dashed: true }) },
    };
    const image = boardSvg(board, measure)!;
    const { svg } = image;
    expect(svg.indexOf('Q&quot;1')).toBeLessThan(svg.indexOf('stroke="#1f2128"'));
    expect(svg.indexOf('marker-end="url(#arrow-black)"')).toBeLessThan(svg.indexOf('&lt;B&gt;'));
    expect(svg).toContain('&amp;');
    expect(svg).toContain('stroke-dasharray="8 6"');
    expect(svg).toContain('text-anchor="start" font-weight="700" text-decoration="underline"');
    expect(svg).toContain('👍 1');
    expect(svg).not.toMatch(/<B>|& </);
    // 40px of margin around the frame, whose title sits 29px above it.
    expect(svg).toMatch(/viewBox="-80 -109 /);
    expect(image.width).toBeGreaterThan(560);
  });

  it('has nothing to draw for an empty board', () => {
    expect(boardSvg(boardOf(), measure)).toBeNull();
  });
});
