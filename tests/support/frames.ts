import type { Frame } from '../../src/domain/frames/model';

export const frame = (id = 'frame', values: Partial<Frame> = {}): Frame => ({
  id,
  title: '프레임 1',
  x: 0,
  y: 0,
  width: 640,
  height: 400,
  color: 'none',
  locked: false,
  ...values,
});
