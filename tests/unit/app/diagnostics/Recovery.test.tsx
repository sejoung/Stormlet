// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, DAMAGED_FILE_NAME } from '../../../../src/app/App';
import { downloadText } from '../../../../src/adapters/files/download';
import { parseBoard } from '../../../../src/adapters/files/stormlet-format';
import { clearLog, recentLog } from '../../../../src/adapters/diagnostics/log';
import { boardOf, sticky } from '../../../support/boards';
import { ids, memoryStore } from '../../../support/app';

vi.mock('../../../../src/adapters/files/download', async (original) => ({
  ...(await original<typeof import('../../../../src/adapters/files/download')>()),
  downloadText: vi.fn(),
}));

/** Replace the browser clipboard; `undefined` removes it, as insecure pages see it. */
const stubClipboard = (clipboard: Partial<Clipboard> | undefined) =>
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });

beforeEach(() => {
  clearLog();
  vi.mocked(downloadText).mockClear();
});
afterEach(() => {
  stubClipboard(undefined);
  vi.restoreAllMocks();
});

describe('recovery', () => {
  it('shows the recovery screen after a crash, downloads the board, copies diagnostics and retries', async () => {
    // React reports caught errors on the console; the log below is what is checked.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = memoryStore(boardOf(sticky('a')));
    const subscribe = store.subscribe;
    let crashes = 1;
    store.subscribe = (listener) => {
      if (crashes-- > 0) throw new Error('boom');
      return subscribe(listener);
    };
    render(<App store={store} newId={ids()} />);

    const heading = screen.getByRole('heading', { name: '문제가 발생했습니다' });
    expect(heading).toHaveFocus();
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
    expect(recentLog().find((entry) => entry.event === 'render.crashed')?.details).toMatchObject({
      name: 'Error',
      message: 'boom',
      components: expect.stringContaining('Workspace'),
    });

    fireEvent.click(screen.getByRole('button', { name: '보드 내려받기' }));
    const [name, content] = vi.mocked(downloadText).mock.calls[0];
    expect(name).toMatch(/\.stormlet$/);
    expect(parseBoard(content).stickies.a).toBeDefined();

    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    fireEvent.click(screen.getByRole('button', { name: '진단 정보 복사' }));
    expect(await screen.findByText('진단 정보를 복사했습니다.')).toBeInTheDocument();
    const report = writeText.mock.calls[0][0] as string;
    expect(report).toMatch(/^Stormlet \d/);
    expect(report).toContain('Board: 1 notes');
    expect(report).toMatch(/ERROR render\.crashed name=Error message=boom/);

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(screen.getByRole('application', { name: '포스트잇 보드' })).toBeInTheDocument();
    expect(recentLog().at(-1)?.event).toBe('render.retried');
  });

  it('offers the original data of an unreadable saved board before anything else', () => {
    const { unmount } = render(<App store={memoryStore()} newId={ids()} damaged="{broken" />);
    const dialog = screen.getByRole('dialog', { name: '저장된 보드를 읽을 수 없습니다' });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장된 데이터 내려받기' }));
    expect(downloadText).toHaveBeenCalledExactlyOnceWith(
      DAMAGED_FILE_NAME,
      '{broken',
      'text/plain',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    render(<App store={memoryStore()} newId={ids()} damaged="{broken" />);
    fireEvent.click(screen.getByRole('button', { name: '빈 보드로 계속' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(downloadText).toHaveBeenCalledTimes(1);
  });

  it('warns while the browser refuses to save and clears the warning once saving works', () => {
    let report: (saved: boolean) => void = () => {};
    const store = Object.assign(memoryStore(), {
      watchSaved: (listener: (saved: boolean) => void) => {
        report = listener;
        return () => {};
      },
    });
    render(<App store={store} newId={ids()} />);
    expect(screen.getByText('브라우저에 자동 저장')).toBeInTheDocument();
    act(() => report(false));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('저장되지 않음');
    expect(alert).toHaveAttribute('title', expect.stringContaining('저장 공간이 가득'));
    act(() => report(true));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('브라우저에 자동 저장')).toBeInTheDocument();
  });

  it('shows the diagnostics to copy by hand from the settings when the clipboard is refused', async () => {
    render(<App store={memoryStore(boardOf(sticky('a'), sticky('b')))} newId={ids()} />);
    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '문제 해결…' }));
    const dialog = screen.getByRole('dialog', { name: '문제 해결' });
    fireEvent.click(within(dialog).getByRole('button', { name: '진단 정보 복사' }));
    expect(await within(dialog).findByRole('status')).toHaveTextContent('복사하지 못했습니다.');
    const text = within(dialog).getByRole('textbox', { name: '진단 정보' });
    expect((text as HTMLTextAreaElement).value).toContain('Board: 2 notes');
    expect(recentLog().map((entry) => entry.event)).toContain('diagnostics.copy-failed');
  });
});
