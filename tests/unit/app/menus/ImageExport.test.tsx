// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../../src/app/App';
import { downloadBlob, downloadText } from '../../../../src/adapters/files/download';
import { svgToPng } from '../../../../src/adapters/files/image-export';
import { boardBounds, ids, memoryStore } from '../../../support/app';
import { boardOf, sticky } from '../../../support/boards';

vi.mock('../../../../src/adapters/files/download', async (original) => ({
  ...(await original<typeof import('../../../../src/adapters/files/download')>()),
  downloadText: vi.fn(),
  downloadBlob: vi.fn(),
}));
// jsdom has no canvas: measure with a fixed width per character, and fake the PNG encoder.
vi.mock('../../../../src/adapters/files/image-export', () => ({
  canvasTextMeasure: () => (text: string) => text.length * 8,
  svgToPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

afterEach(() => vi.clearAllMocks());
const exportAs = (item: string) => {
  fireEvent.click(screen.getByRole('button', { name: '파일' }));
  fireEvent.click(
    within(screen.getByRole('menu', { name: '파일' })).getByRole('menuitem', { name: item }),
  );
};

describe('image export', () => {
  it('downloads the board as an SVG or PNG named after its title', async () => {
    const store = memoryStore({ ...boardOf(sticky('a', { text: '회고' })), title: 'Retro' });
    render(<App store={store} newId={ids()} />);
    boardBounds();
    exportAs('SVG 이미지로 내보내기');
    expect(await screen.findByText('Retro.svg을(를) 내보냈습니다.')).toBeInTheDocument();
    const [name, svg, type] = vi.mocked(downloadText).mock.calls[0];
    expect([name, type]).toEqual(['Retro.svg', 'image/svg+xml']);
    expect(svg).toContain('회고');
    exportAs('PNG 이미지로 내보내기');
    expect(await screen.findByText('Retro.png을(를) 내보냈습니다.')).toBeInTheDocument();
    expect(vi.mocked(svgToPng).mock.calls[0][0]).toBe(svg);
    expect(vi.mocked(downloadBlob).mock.calls[0][0]).toBe('Retro.png');
  });

  it('reports a picture that could not be made', async () => {
    vi.mocked(svgToPng).mockRejectedValueOnce(new Error('too big'));
    render(<App store={memoryStore(boardOf(sticky('a')))} newId={ids()} />);
    boardBounds();
    exportAs('PNG 이미지로 내보내기');
    expect(
      await screen.findByText('이미지를 만들지 못했습니다. 보드가 너무 크면 SVG로 내보내 보세요.'),
    ).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
