// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { clearLog } from '../../../../src/adapters/diagnostics/log';
import { boardOf, sticky } from '../../../support/boards';
import { chooseFromFile, driveButton, noDriveButton, renderWithDrive } from './support';

const boards = { id: 'folder', name: 'Boards' };
const file = { id: 'file1', name: 'board.stormlet', version: '1' };
const account = { id: 'me', email: 'me@example.com' };

/** A board linked to `file1` and connected, as after saving it to Drive. */
async function linkedBoard(options: { account?: typeof account } = { account }) {
  const rendered = renderWithDrive(
    boardOf(sticky('a')),
    { file, base: boardOf(sticky('a')), ...options },
    { folder: { ...boards, account: 'me' } },
  );
  rendered.drive.files.set('file1', {
    name: 'board.stormlet',
    version: 1,
    board: boardOf(sticky('a')),
  });
  act(() => rendered.auth.elsewhere.token());
  return rendered;
}
const disconnect = async (forget: boolean) => {
  await chooseFromFile('Google Drive 연결 해제…');
  const dialog = screen.getByRole('dialog', { name: 'Google Drive 연결 해제' });
  if (forget)
    fireEvent.click(
      within(dialog).getByRole('checkbox', { name: /Drive 파일·폴더 정보도 지우기/ }),
    );
  fireEvent.click(within(dialog).getByRole('button', { name: '연결 해제' }));
};

afterEach(() => clearLog());

describe('disconnecting Google Drive', () => {
  it('keeps the file and folder, so reconnecting continues with the same file', async () => {
    const { auth, drive, folder, links } = await linkedBoard();
    await waitFor(() => expect(driveButton()).toHaveTextContent('저장됨'));
    await disconnect(false);
    expect(auth.disconnect).toHaveBeenCalledWith(false);
    expect(
      await screen.findByText(/다시 연결하면 같은 파일에 이어서 저장합니다/),
    ).toBeInTheDocument();
    expect(driveButton()).toHaveTextContent('다시 연결');
    expect([links.link?.file.id, folder.read()?.id]).toEqual(['file1', 'folder']);

    act(() => auth.elsewhere.token());
    await waitFor(() => expect(driveButton()).toHaveTextContent('저장됨'));
    expect(drive.calls.filter((call) => call.startsWith('create'))).toEqual([]);
  });

  it('can forget the files and folder too', async () => {
    const { folder, links, sync } = await linkedBoard();
    await disconnect(true);
    await waitFor(() => expect(sync.current.status).toBe('unlinked'));
    expect([links.link, folder.read()]).toEqual([null, null]);
    noDriveButton();
    expect(
      await screen.findByText(
        'Google Drive 연결을 해제하고 이 브라우저의 Drive 파일·폴더 정보를 지웠습니다.',
      ),
    ).toBeInTheDocument();
  });

  it('stops for a file of another account, naming that account', async () => {
    const { drive } = await linkedBoard({ account: { id: 'work', email: 'work@example.com' } });
    await waitFor(() => expect(driveButton()).toHaveTextContent('저장 안 됨'));
    fireEvent.click(driveButton());
    expect(screen.getByRole('dialog', { name: 'Google Drive' })).toHaveTextContent(
      '다른 Google 계정(work@example.com)',
    );
    expect(drive.calls).toEqual([]);
  });

  it('finds the linked file again in the Picker when Drive no longer shows it', async () => {
    const { auth, drive } = await linkedBoard();
    drive.files.delete('file1');
    await waitFor(() => expect(driveButton()).toHaveTextContent('저장 안 됨'));
    fireEvent.click(driveButton());
    auth.pick.mockResolvedValueOnce({ id: 'other', name: 'Other.stormlet' });
    fireEvent.click(screen.getByRole('button', { name: 'Drive에서 다시 찾기…' }));
    expect(
      await screen.findByText('이 보드의 Drive 파일이 아닙니다. 같은 파일을 골라 주세요.'),
    ).toBeInTheDocument();

    drive.files.set('file1', { name: 'board.stormlet', version: 1, board: boardOf(sticky('a')) });
    fireEvent.click(driveButton());
    auth.pick.mockResolvedValueOnce({ id: 'file1', name: 'board.stormlet' });
    fireEvent.click(screen.getByRole('button', { name: 'Drive에서 다시 찾기…' }));
    await waitFor(() => expect(driveButton()).toHaveTextContent('저장됨'));
  });

  it('does not save into a folder of another account', async () => {
    const { auth } = renderWithDrive(boardOf(sticky('a')), null, {
      folder: { ...boards, account: 'work' },
    });
    act(() => auth.elsewhere.token());
    auth.pick.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: 'Drive에 저장' }));
    await waitFor(() => expect(auth.pick).toHaveBeenCalledWith('folder', expect.anything()));
  });
});
