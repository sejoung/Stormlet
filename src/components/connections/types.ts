import type { Connection, Endpoint } from '../../domain/connections/model';

export interface ConnectionInteraction {
  selectedId: string | null;
  onSelect(id: string): void;
  onCreate(from: Endpoint, to: Endpoint): boolean;
  onChange(id: string, values: Partial<Omit<Connection, 'id'>>): void;
  onEditLabel(id: string): void;
}
