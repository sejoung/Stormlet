import type { Board, Sticky } from '../../src/domain/model';
import type { Frame } from '../../src/domain/frames/model';
import { DEFAULT_CONNECTION } from '../../src/domain/connections/model';

type Lang = 'ko' | 'en';
const words = {
  ko: {
    title: '스프린트 회고',
    frames: ['잘된 점', '아쉬운 점', '해볼 것'],
    notes: [
      ['배포 자동화로 릴리스가 빨라짐', '리뷰가 하루 안에 끝남'],
      ['요구사항이 늦게 바뀜', '테스트 환경이 자주 멈춤'],
      ['스프린트 시작 전에 범위 확정', '테스트 환경 모니터링 추가'],
    ],
    line: '해결 방안',
    other: '다음 분기 계획',
    otherNotes: ['채용 일정', '온보딩 문서 정리'],
  },
  en: {
    title: 'Sprint retro',
    frames: ['Went well', 'To improve', 'Try next'],
    notes: [
      ['Automated deploys sped up releases', 'Reviews done within a day'],
      ['Requirements changed late', 'Test environment kept stalling'],
      ['Agree on scope before the sprint', 'Monitor the test environment'],
    ],
    line: 'Fix',
    other: 'Next quarter plan',
    otherNotes: ['Hiring schedule', 'Tidy onboarding docs'],
  },
};
const COLORS = ['green', 'pink', 'sky'] as const;

const note = (id: string, text: string, x: number, y: number, color: Sticky['color']): Sticky => ({
  id,
  kind: null,
  color,
  text,
  x,
  y,
  z: 1,
  width: 220,
  height: 150,
});

/** The retrospective board the guide's screenshots show. */
export function sampleBoard(lang: Lang): Board {
  const w = words[lang];
  const frames: Record<string, Frame> = {};
  const stickies: Record<string, Sticky> = {};
  w.frames.forEach((title, column) => {
    const x = 40 + column * 540;
    frames[`f${column}`] = {
      id: `f${column}`,
      title,
      x,
      y: 40,
      width: 500,
      height: 250,
      color: 'none',
      borderWidth: 2,
      locked: false,
    };
    w.notes[column].forEach((text, row) => {
      const id = `n${column}${row}`;
      stickies[id] = note(id, text, x + 20 + row * 240, 100, COLORS[column]);
    });
  });
  stickies.n10.reactions = [{ emoji: '👍', people: ['a', 'b'] }];
  return {
    title: w.title,
    stickies,
    frames,
    connections: {
      fix: {
        ...DEFAULT_CONNECTION,
        id: 'fix',
        from: { stickyId: 'n11', side: 'auto' },
        to: { stickyId: 'n21', side: 'auto' },
        label: w.line,
      },
    },
  };
}

/** A second board, kept from a tab closed earlier, for the Recent boards dialog. */
export function otherBoard(lang: Lang): Board {
  const w = words[lang];
  return {
    title: w.other,
    stickies: Object.fromEntries(
      w.otherNotes.map((text, index) => [
        `o${index}`,
        note(`o${index}`, text, index * 260, 0, 'yellow'),
      ]),
    ),
  };
}

export const sampleText = (lang: Lang) => words[lang].notes[1][1];
