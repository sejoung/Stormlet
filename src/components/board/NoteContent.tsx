import { useRef, useState, type KeyboardEvent } from 'react';
import type { Sticky } from '../../domain/model';
import type { StickySize } from '../../domain/sticky-size';
import { MAX_NOTE_LENGTH } from '../../domain/note-details';
import { noteTextStyle, useFittedText } from './useFittedText';
import { DRAFT_FIELD, useDraft } from '../common/drafts';
import { isComposing } from '../common/keyboard';

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
  onDone(text: string): void;
}) {
  const [text, setText] = useState(initial);
  const composing = useRef(false);
  const completed = useRef(false);
  const { ref, fontSize } = useFittedText(note.id, text, size, note);
  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    onDone(text.trim());
  };
  useDraft(finish);
  const onKeyDown = (event: KeyboardEvent) => {
    // Formatting keys belong to the note toolbar, native editing keys stay in the textarea.
    if ((event.ctrlKey || event.metaKey) && ['b', 'i', 'u', 's'].includes(event.key.toLowerCase()))
      return;
    event.stopPropagation();
    if (composing.current || isComposing(event)) return;
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
          aria-label="스티키 내용"
          data-draft={DRAFT_FIELD.note}
          style={noteTextStyle(note, fontSize)}
          // Focus follows an explicit edit or creation action.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={text}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={finish}
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
        Enter 완료 · Shift+Enter 줄바꿈{' '}
        <span>
          {text.length.toLocaleString()} / {MAX_NOTE_LENGTH.toLocaleString()}
        </span>
      </span>
    </>
  );
}
