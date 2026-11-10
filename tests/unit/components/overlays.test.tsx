// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../../../src/components/dialogs/Modal';
import { ContextMenu } from '../../../src/components/menus/ContextMenu';

/** A dialog whose parent re-renders on every keystroke and hands it a new `onClose` each time. */
function Typing({ onClose }: { onClose(): void }) {
  const [text, setText] = useState('');
  return (
    <Modal title="Dialog" onClose={() => onClose()}>
      <input aria-label="First" />
      <input aria-label="Second" value={text} onChange={(event) => setText(event.target.value)} />
    </Modal>
  );
}

describe('modal dialog', () => {
  it('keeps focus in the field being typed in when its parent re-renders', () => {
    const onClose = vi.fn();
    render(
      <>
        <button type="button">Opener</button>
        <Typing onClose={onClose} />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'First' })).toHaveFocus();
    const second = screen.getByRole('textbox', { name: 'Second' });
    second.focus();
    fireEvent.change(second, { target: { value: '한' } });
    fireEvent.change(second, { target: { value: '한글' } });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cycles Tab through links too, skipping disabled and untabbable controls', () => {
    render(
      <Modal title="Help" onClose={() => {}}>
        <button type="button" disabled>
          Disabled
        </button>
        <span tabIndex={-1}>Skipped</span>
        <a href="/manual">Manual</a>
      </Modal>,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    const link = screen.getByRole('link', { name: 'Manual' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(link).toHaveFocus();
    fireEvent.keyDown(link, { key: 'Tab' });
    expect(close).toHaveFocus();
  });

  it('leaves Escape to the IME while it composes', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Dialog" onClose={onClose}>
        <input aria-label="Field" />
      </Modal>,
    );
    const field = screen.getByRole('textbox', { name: 'Field' });
    fireEvent.keyDown(field, { key: 'Escape', isComposing: true });
    fireEvent.keyDown(field, { key: 'Escape', keyCode: 229 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/** A menu opened from a button, closed by the parent as the app does. */
function MenuHost({ onClose }: { onClose(): void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Opener
      </button>
      {open && (
        <ContextMenu
          point={{ x: 10, y: 10 }}
          label="Menu"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <button type="button" role="menuitem">
            Item
          </button>
        </ContextMenu>
      )}
    </>
  );
}

describe('context menu', () => {
  it('returns focus to where it was opened from when Tab closes it', () => {
    render(<MenuHost onClose={() => {}} />);
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();
    fireEvent.click(opener);
    const item = screen.getByRole('menuitem', { name: 'Item' });
    expect(item).toHaveFocus();
    fireEvent.keyDown(item, { key: 'Tab' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('stays open for Escape while the IME composes', () => {
    const onClose = vi.fn();
    render(<MenuHost onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();
    fireEvent.click(opener);
    const item = screen.getByRole('menuitem', { name: 'Item' });
    fireEvent.keyDown(item, { key: 'Escape', isComposing: true });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(item, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });
});
