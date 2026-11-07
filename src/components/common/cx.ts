/** Join the truthy class names: `cx('sticky', selected && 'is-selected')`. */
export const cx = (...names: (string | false | null | undefined)[]): string =>
  names.filter(Boolean).join(' ');
