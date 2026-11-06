const paths = {
  undo: 'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12',
  redo: 'm15 5 5 5-5 5m5-5h-9a6 6 0 0 0 0 12',
  open: 'M3 8V5h7l2 3h9v12H3V8Zm0 4h18',
  save: 'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',
  select: 'M5 3v17l5-5 4 7 3-2-4-7h7L5 3Z',
  pan: 'M8 12V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2Z',
  note: 'M4 3h16v13l-5 5H4V3Zm11 18v-5h5',
  plus: 'M12 5v14M5 12h14',
  connect: 'M3 6h7v12h11m-5-5 5 5-5 5',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  duplicate: 'M8 8h13v13H8V8ZM16 8V3H3v13h5',
  lock: 'M5 10h14v11H5V10Zm3 0V7a4 4 0 0 1 8 0v3',
  unlock: 'M5 10h14v11H5V10Zm3 0V7a4 4 0 0 1 8 0',
  group: 'M3 3h7v7H3V3Zm11 11h7v7h-7v-7ZM14 3h7v7M3 14v7h7',
  grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  align: 'M4 3v18M8 6h12M8 12h8M8 18h12',
  emoji: 'M8 14s1 3 4 3 4-3 4-3M8 8h.01M16 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  close: 'm6 6 12 12M6 18 18 6',
  search: 'm16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  fit: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
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
