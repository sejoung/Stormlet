// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/app/App';
import { CREATION_DEFAULTS_KEY } from '../../../src/adapters/storage/creation-defaults';
import { memoryStore, ids, boardBounds } from '../../support/app';
import { boardOf, sticky } from '../../support/boards';

afterEach(() => localStorage.removeItem(CREATION_DEFAULTS_KEY));
const note = (id: string) => screen.getByRole('button', { name: `도메인 이벤트: ${id}` });

describe('tool default flyouts', () => {
  it('opens only on tool click and uses the chosen color for new notes without recoloring a selection', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(note('a'));
    await user.click(screen.getByRole('button', { name: '포스트잇 도구' }));
    const panel = screen.getByRole('dialog', { name: '포스트잇 기본 설정' });
    expect(within(panel).getAllByRole('button', { name: /기본 색상$/ })).toHaveLength(16);
    await user.click(within(panel).getByRole('button', { name: '파란색 기본 색상' }));
    expect(store.board.stickies.a.color).toBe('orange');
    expect(screen.getByRole('button', { name: '실행 취소' })).toBeDisabled();
    fireEvent.pointerDown(board, { button: 0, clientX: 800, clientY: 400 });
    fireEvent.pointerUp(board, { button: 0, clientX: 800, clientY: 400 });
    expect(screen.queryByRole('dialog', { name: '포스트잇 기본 설정' })).not.toBeInTheDocument();
    expect(store.board.stickies.s1).toMatchObject({
      color: 'blue',
      kind: null,
      width: 160,
      height: 160,
    });
    await user.type(screen.getByRole('textbox', { name: '스티키 내용' }), '새 생각{Enter}');
    await user.keyboard('{Control>}z{/Control}{Control>}z{/Control}');
    expect(store.board.stickies.a.color).toBe('orange');
    expect(store.board.stickies.s1).toBeUndefined();
    await user.click(screen.getByRole('button', { name: '포스트잇 도구' }));
    expect(screen.getByRole('button', { name: '파란색 기본 색상' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('applies the selected color to bulk entry and retains it after reopening the app', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    const view = render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(screen.getByRole('button', { name: '포스트잇 도구' }));
    await user.click(screen.getByRole('button', { name: '분홍색 기본 색상' }));
    await user.click(screen.getByRole('button', { name: '여러 개 한 번에' }));
    expect(screen.queryByRole('dialog', { name: '포스트잇 기본 설정' })).not.toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: '포스트잇 여러 개 입력' }),
      '첫째{Enter}둘째',
    );
    await user.click(screen.getByRole('button', { name: '보드에 붙이기' }));
    expect(Object.values(store.board.stickies).every((item) => item.color === 'pink')).toBe(true);
    view.unmount();
    render(<App store={memoryStore()} newId={ids()} />);
    boardBounds();
    await user.click(screen.getByRole('button', { name: '포스트잇 도구' }));
    expect(screen.getByRole('button', { name: '분홍색 기본 색상' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: '가운데 붙이기' }));
    expect(screen.getByRole('button', { name: '분홍색 포스트잇: 빈 스티키' })).toBeInTheDocument();
  });

  it('supports keyboard navigation, Escape, repeated clicks and outside dismissal', async () => {
    const user = userEvent.setup();
    render(<App store={memoryStore()} newId={ids()} />);
    boardBounds();
    const trigger = screen.getByRole('button', { name: '포스트잇 도구' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '노란색 기본 색상' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: '주황색 기본 색상' })).toHaveFocus();
    await user.keyboard('{Enter}{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(screen.getByRole('button', { name: '선택 · 이동' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(trigger);
    await user.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: '메모 검색' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses smooth elbow arrows initially and applies a chosen line preset to both preview and creation', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a'), sticky('b', { x: 400, y: 200 })));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(screen.getByRole('button', { name: '연결선 도구' }));
    expect(screen.getByRole('button', { name: '꺾인 화살표 기본' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(note('a'));
    await user.click(note('b'));
    expect(store.board.connections?.s1).toMatchObject({ path: 'elbow', endArrow: true });
    expect(
      board.querySelector('[data-connection-id="s1"] .connection-stroke')?.getAttribute('d'),
    ).toContain(' Q ');
    await user.click(screen.getByRole('button', { name: '연결선 도구' }));
    await user.click(screen.getByRole('button', { name: '선' }));
    await user.click(screen.getByRole('button', { name: '파란색 기본 연결선' }));
    await user.selectOptions(screen.getByRole('combobox', { name: '기본 연결선 두께' }), '4');
    await user.click(
      within(screen.getByRole('dialog', { name: '연결선 기본 설정' })).getByRole('checkbox', {
        name: '점선',
      }),
    );
    expect(store.board.connections?.s1).toMatchObject({
      path: 'elbow',
      color: 'slate',
      width: 2,
      dashed: false,
    });
    await user.click(note('a'));
    fireEvent.pointerMove(board, { clientX: 680, clientY: 340 });
    const preview = board.querySelector('[data-connection-id=""] .connection-stroke')!;
    expect(preview).toHaveAttribute('stroke', '#4262ff');
    expect(preview).toHaveAttribute('stroke-width', '4');
    expect(preview).not.toHaveAttribute('marker-end');
    await user.click(note('b'));
    expect(store.board.connections?.s2).toMatchObject({
      path: 'straight',
      color: 'blue',
      width: 4,
      endArrow: false,
      dashed: true,
    });
  });

  it('uses a saved connection style for side-port connections and preserves it on reload', async () => {
    const user = userEvent.setup();
    const view = render(<App store={memoryStore()} newId={ids()} />);
    boardBounds();
    await user.click(screen.getByRole('button', { name: '연결선 도구' }));
    await user.click(screen.getByRole('button', { name: '곡선 화살표' }));
    await user.click(screen.getByRole('button', { name: '빨간색 기본 연결선' }));
    view.unmount();
    const store = memoryStore(boardOf(sticky('a'), sticky('b', { x: 400, y: 200 })));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(note('a'));
    fireEvent.pointerDown(within(note('a')).getByRole('button', { name: '오른쪽 연결점' }), {
      button: 0,
      clientX: 366,
      clientY: 140,
    });
    fireEvent.pointerMove(board, { clientX: 680, clientY: 340 });
    fireEvent.pointerUp(board, { clientX: 680, clientY: 340 });
    expect(store.board.connections?.s1).toMatchObject({
      path: 'curve',
      color: 'red',
      endArrow: true,
    });
    await user.click(screen.getByRole('button', { name: '연결선 도구' }));
    expect(screen.getByRole('button', { name: '곡선 화살표 기본' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
