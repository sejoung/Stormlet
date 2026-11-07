import { useRef, useState } from 'react';
import { useDraft } from './drafts';

/**
 * A label that turns into a text field: `begin` opens it with the current value, `finish`
 * closes it once (blur after Enter does not commit twice) and can return focus to the
 * element in `trigger`. While open, the draft is committed when the app flushes editors.
 */
export function useInlineEdit<T extends HTMLElement>(
  value: string,
  onCommit: (draft: string) => void,
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const done = useRef(false);
  const trigger = useRef<T>(null);
  useDraft(() => {
    if (editing) onCommit(draft);
  });
  return {
    editing,
    draft,
    setDraft,
    trigger,
    begin: () => {
      done.current = false;
      setDraft(value);
      setEditing(true);
    },
    finish: (commit: boolean, restoreFocus = false) => {
      if (done.current) return;
      done.current = true;
      if (commit) onCommit(draft);
      setEditing(false);
      if (restoreFocus) queueMicrotask(() => trigger.current?.focus());
    },
  };
}
