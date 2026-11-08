// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../../../src/app/App';
import { downloadText } from '../../../../src/adapters/files/download';
import { memoryStore, ids } from '../../../support/app';

vi.mock('../../../../src/adapters/files/download', async (original) => ({
  ...(await original<typeof import('../../../../src/adapters/files/download')>()),
  downloadText: vi.fn(),
}));

describe('toolbar menus', () => {
  it('opens from the keyboard, moves with the arrows and returns focus on Escape', async () => {
    const user = userEvent.setup();
    render(<App store={memoryStore()} newId={ids()} />);
    const file = screen.getByRole('button', { name: '파일' });
    expect(file).toHaveAttribute('aria-expanded', 'false');
    file.focus();
    await user.keyboard('{ArrowDown}');
    expect(file).toHaveAttribute('aria-expanded', 'true');
    // A build without Drive has only the local file commands.
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.firstChild?.textContent)).toEqual(['열기…', '파일로 내려받기']);
    expect(items[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
    // Board shortcuts stay out of an open menu.
    await user.keyboard('n');
    expect(screen.getByRole('menu', { name: '파일' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(file).toHaveFocus();

    await user.click(file);
    await user.click(screen.getByRole('application', { name: '포스트잇 보드' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(file);
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens files with ⌘/Ctrl+O and downloads with ⌘/Ctrl+S', () => {
    render(<App store={memoryStore()} newId={ids()} />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const choose = vi.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    expect(choose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '파일' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^열기…/ }));
    expect(choose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    expect(downloadText).toHaveBeenCalledTimes(1);
  });

  it('lists help and troubleshooting under Settings', () => {
    render(<App store={memoryStore()} newId={ids()} />);
    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^단축키 도움말/ }));
    expect(screen.getByRole('dialog', { name: '단축키' })).toBeInTheDocument();
  });
});
