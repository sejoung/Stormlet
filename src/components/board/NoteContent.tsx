import { useRef, useState, type KeyboardEvent } from 'react';
import type { Sticky } from '../../domain/model';
import type { StickySize } from '../../domain/sticky-size';
import { MAX_NOTE_LENGTH } from '../../domain/note-details';
import { isText } from '../../domain/text/model';
import { noteTextStyle, useFittedText } from './useFittedText';
import { DRAFT_FIELD, useDraft } from '../common/drafts';
import { isComposing } from '../common/keyboard';
import { useT } from '../common/i18n';
import type { NextNote } from '../../domain/note-actions';
import { fittedTextSize } from '../text/fit-size';

export function StickyText({ note, size }: { note: Sticky; size: StickySize }) {
  const { ref, fontSize } = useFittedText(note.id, note.text, size, note);
  return (
    <div className="sticky-content">
      <p ref={ref} className="sticky-text" style={noteTextStyle(note, fontSize)}>
        {note.text}
      </p>
    </div>
  );
}

/**
 * The measuring copy is a paragraph, which drops a trailing empty line that the textarea
 * still shows (the line the caret moves to after Shift+Enter). A zero-width space keeps
 * that line, and gives an empty note one line, so both measure like the textarea.
 */
const measured = (text: string) => `${text}\u200b`;

export function StickyEditor({
  note,
  initial,
  size,
  onDone,
}: {
  note: Sticky;
  initial: string;
  size: StickySize;
  /** Editing finished; `next` asks for a new note to the right or below to type on in. */
  onDone(text: string, next?: NextNote, size?: StickySize): void;
}) {
  const t = useT();
  const [text, setText] = useState(initial);
  const freeText = isText(note);
  const composing = useRef(false);
  const completed = useRef(false);
  const { ref, fontSize } = useFittedText(note.id, text, size, note);
  const finish = (next?: NextNote) => {
    if (completed.current) return;
    completed.current = true;
    onDone(
      freeText ? text : text.trim(),
      next,
      freeText ? fittedTextSize(ref.current, size) : undefined,
    );
  };
  useDraft(() => finish());
  const onKeyDown = (event: KeyboardEvent) => {
    // Formatting keys belong to the note toolbar, native editing keys stay in the textarea.
    if ((event.ctrlKey || event.metaKey) && ['b', 'i', 'u', 's'].includes(event.key.toLowerCase()))
      return;
    event.stopPropagation();
    if (composing.current || isComposing(event)) return;
    if (freeText) {
      if (
        event.key === 'Escape' ||
        (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) ||
        event.key === 'Tab'
      ) {
        if (event.key !== 'Tab') event.preventDefault();
        finish();
        if (event.key !== 'Tab')
          (event.currentTarget.closest('[data-sticky-id]') as HTMLElement | null)?.focus();
      }
      return;
    }
    // Tab continues to the right, Cmd/Ctrl+Enter below: brainstorming without the mouse.
    const next: NextNote | null =
      event.key === 'Tab' && !event.shiftKey
        ? 'right'
        : event.key === 'Enter' && (event.ctrlKey || event.metaKey)
          ? 'below'
          : null;
    if (next) {
      event.preventDefault();
      return finish(next);
    }
    if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
      event.preventDefault();
      finish();
      (event.currentTarget.closest('[data-sticky-id]') as HTMLElement | null)?.focus();
    }
  };
  return (
    <>
      <div className="sticky-content is-editing">
        <p
          ref={ref}
          className="sticky-text sticky-measure"
          aria-hidden="true"
          style={noteTextStyle(note, fontSize)}
        >
          {measured(text)}
        </p>
        <textarea
          className="sticky-editor"
          aria-label={t(freeText ? 'text.editor' : 'note.editor')}
          data-draft={DRAFT_FIELD.note}
          style={noteTextStyle(note, fontSize)}
          // Focus follows an explicit edit or creation action.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={text}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => finish()}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.stopPropagation()}
        />
      </div>
      <span className="editing-hint">
        {t(freeText ? 'text.editingHint' : 'note.editingHint')}{' '}
        <span>
          {text.length.toLocaleString()} / {MAX_NOTE_LENGTH.toLocaleString()}
        </span>
      </span>
    </>
  );
}
