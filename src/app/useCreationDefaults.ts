import { useState } from 'react';
import type { StickyColor } from '../domain/model';
import type { ConnectionStyle } from '../domain/connections/model';
import type { CreationDefaults } from '../domain/creation-defaults';
import { readCreationDefaults, writeCreationDefaults } from '../adapters/storage/creation-defaults';

export function useCreationDefaults() {
  const [defaults, setDefaults] = useState(readCreationDefaults);
  const update = (next: CreationDefaults) => {
    writeCreationDefaults(next);
    setDefaults(next);
  };
  return {
    ...defaults,
    onStickyColor: (stickyColor: StickyColor) => update({ ...defaults, stickyColor }),
    onConnection: (style: Partial<ConnectionStyle>) =>
      update({ ...defaults, connection: { ...defaults.connection, ...style } }),
  };
}
