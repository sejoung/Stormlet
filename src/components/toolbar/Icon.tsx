const paths = {
  undo: 'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12',
  redo: 'm15 5 5 5-5 5m5-5h-9a6 6 0 0 0 0 12',
  open: 'M3 8V5h7l2 3h9v12H3V8Zm0 4h18',
  save: 'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',
  select: 'M5 3v17l5-5 4 7 3-2-4-7h7L5 3Z',
  pan: 'M8 12V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2Z',
  note: 'M4 3h16v13l-5 5H4V3Zm11 18v-5h5',
  plus: 'M12 5v14M5 12h14',
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
