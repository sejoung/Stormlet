import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CREATE_ATTEMPTS,
  CREATE_BACKOFF,
  DRIVE_UPLOAD,
  DriveClient,
  LATE_UPLOAD,
} from '../../../../src/adapters/drive/client';
import { memoryCreations } from '../../../../src/adapters/drive/creations';
import { serializeBoard } from '../../../../src/adapters/files/stormlet-format';
import type { RemoteError } from '../../../../src/domain/sync/remote';
import { boardOf, sticky } from '../../../support/boards';

const board = { ...boardOf(sticky('a')), title: 'Plan' };
const newer = { ...board, title: 'Plan', stickies: { ...board.stickies, b: sticky('b') } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const lost = () => new TypeError('Failed to fetch');

/**
 * Drive as a list of answers keyed by request, so each test says what Drive does to each
 * call: `GET ids`, `POST upload`, `GET meta`, `GET media`, `GET version`, `PATCH upload`.
 */
function fakeDrive(
  script: Record<string, (Response | Error | Promise<Response>)[]>,
  creations = memoryCreations(),
) {
  let now = 1_000;
  const log: string[] = [];
  const lists: string[] = [];
  const bodies: string[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
    // The folder listing that picks a free name; an empty folder unless the test says.
    if (url.includes('?q=')) {
      lists.push(decodeURIComponent(url));
      return (await script['GET list']?.shift()) ?? json({ files: [] });
    }
    const key = url.includes('generateIds')
      ? 'GET ids'
      : url.startsWith(DRIVE_UPLOAD)
        ? `${method} upload`
        : url.includes('alt=media')
          ? 'GET media'
          : url.includes('fields=version')
            ? 'GET version'
            : 'GET meta';
    log.push(key);
    if (init.body) bodies.push(String(init.body));
    const reply = await script[key]?.shift();
    if (!reply) throw new Error(`unexpected ${key}`);
    if (reply instanceof Error) throw reply;
    return reply;
  }) as unknown as typeof fetch;
  const client = new DriveClient(
    () => 'token',
    fetcher,
    undefined,
    creations,
    () => now,
  );
  const later = (ms: number) => (now += ms);
  return { client, log, lists, bodies, creations, later };
}

const created = (version = '1') => json({ id: 'reserved', name: 'Plan.stormlet', version });
const meta = (parents = ['folder']) =>
  json({ id: 'reserved', name: 'Plan.stormlet', version: '1', parents });
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (error: RemoteError) => `${error.reason}: ${error.message}`,
  );

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('creating Drive files without duplicates', () => {
  it('creates the file under an ID reserved beforehand', async () => {
    const drive = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': [created()],
    });
    expect(await drive.client.create('folder', board)).toEqual({
      id: 'reserved',
      name: 'Plan.stormlet',
      version: '1',
    });
    expect(drive.log).toEqual(['GET ids', 'POST upload']);
    expect(drive.bodies[0]).toContain(
      '{"id":"reserved","name":"Plan.stormlet","mimeType":"application/json","parents":["folder"]}',
    );
  });

  it('finds the file an upload made when its answer was lost, instead of uploading again', async () => {
    const drive = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': [lost()],
      'GET meta': [meta()],
      'GET media': [new Response(serializeBoard(board))],
    });
    expect(await drive.client.create('folder', board)).toMatchObject({ id: 'reserved' });
    expect(drive.log).toEqual(['GET ids', 'POST upload', 'GET meta', 'GET media']);
  });

  it('retries with the same ID while the file does not exist, then gives up', async () => {
    const drive = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': [json({}, 503), lost(), created()],
      'GET meta': [json({}, 404), json({}, 404)],
    });
    const result = drive.client.create('folder', board);
    await vi.advanceTimersByTimeAsync(CREATE_BACKOFF * 3);
    expect(await result).toMatchObject({ id: 'reserved' });
    expect(drive.log.filter((call) => call === 'GET ids')).toHaveLength(1);
    expect(drive.bodies.every((body) => body.includes('"id":"reserved"'))).toBe(true);

    const offline = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': Array.from({ length: CREATE_ATTEMPTS }, lost),
      'GET meta': Array.from({ length: CREATE_ATTEMPTS }, () => json({}, 404)),
    });
    const attempt = failure(offline.client.create('folder', board));
    await vi.advanceTimersByTimeAsync(CREATE_BACKOFF * 2 ** CREATE_ATTEMPTS);
    expect(await attempt).toBe('network: Failed to fetch');
    expect(offline.log.filter((call) => call === 'POST upload')).toHaveLength(CREATE_ATTEMPTS);
  });

  it('reuses the reservation when saving to the same folder again, updating what landed', async () => {
    const drive = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': [lost(), json({}, 409)],
      // Drive did not list the first upload yet, so the first call gives up.
      'GET meta': [new TypeError('offline'), meta()],
      'GET media': [new Response(serializeBoard(board))],
      'GET version': [json({ version: '1' })],
      'PATCH upload': [created('2')],
    });
    expect(await failure(drive.client.create('folder', board))).toBe('network: offline');
    // The user saves again after editing: the old upload is found and brought up to date.
    expect(await drive.client.create('folder', newer)).toEqual({
      id: 'reserved',
      name: 'Plan.stormlet',
      version: '2',
    });
    expect(drive.log).toEqual([
      'GET ids',
      'POST upload',
      'GET meta',
      'POST upload',
      'GET meta',
      'GET media',
      'GET version',
      'PATCH upload',
    ]);
    expect(drive.bodies.at(-1)).toBe(serializeBoard(newer));
  });

  it('reserves a new ID once the board moved on, never taking over the earlier upload', async () => {
    const drive = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] }), json({ ids: ['fresh'] })],
      'POST upload': [lost(), json({ id: 'fresh', name: 'Plan.stormlet', version: '1' })],
      'GET meta': [new TypeError('offline')],
    });
    expect(await failure(drive.client.create('folder', board))).toBe('network: offline');
    // Another file was opened (or syncing stopped): a different board saves to the folder.
    drive.client.forgetUnconfirmed();
    expect(drive.creations.read()).toBeNull();
    expect(await drive.client.create('folder', newer)).toMatchObject({ id: 'fresh' });
    expect(drive.log).toEqual(['GET ids', 'POST upload', 'GET meta', 'GET ids', 'POST upload']);
    expect(drive.bodies.at(-1)).toContain('"id":"fresh"');
  });

  it('refuses to take over a reserved ID that holds something else or sits elsewhere', async () => {
    const other = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': [json({}, 409)],
      'GET meta': [meta()],
      'GET media': [new Response(serializeBoard(boardOf()))],
    });
    expect(await failure(other.client.create('folder', board))).toBe(
      'conflict: The reserved file holds something else.',
    );
    const moved = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': [lost()],
      'GET meta': [meta(['elsewhere'])],
      'GET media': [new Response(serializeBoard(board))],
    });
    expect(await failure(moved.client.create('folder', board))).toMatch(/^conflict/);
  });

  it('stops on failures a retry cannot fix, and on a missing reservation', async () => {
    const refused = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': [json({}, 403)],
    });
    expect(await failure(refused.client.create('folder', board))).toMatch(/^permission/);
    expect(refused.log).toEqual(['GET ids', 'POST upload']);
    const none = fakeDrive({ 'GET ids': [json({})] });
    expect(await failure(none.client.create('folder', board))).toBe(
      'network: Drive did not reserve a file ID.',
    );
    // Drive answering with another ID is never taken as this file.
    const swapped = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': Array.from({ length: CREATE_ATTEMPTS }, () =>
        json({ id: 'other', name: 'Plan.stormlet', version: '1' }),
      ),
      'GET meta': Array.from({ length: CREATE_ATTEMPTS }, () => json({}, 404)),
    });
    const result = failure(swapped.client.create('folder', board));
    await vi.advanceTimersByTimeAsync(CREATE_BACKOFF * 2 ** CREATE_ATTEMPTS);
    expect(await result).toBe('conflict: Drive created a different file.');
  });

  it('remembers a creation until Drive answers, so a reloaded page can find its file', async () => {
    let answer: (reply: Response) => void = () => {};
    const drive = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': [new Promise<Response>((resolve) => (answer = resolve))],
    });
    const creating = drive.client.create('folder', board);
    await vi.advanceTimersByTimeAsync(0);
    expect(drive.creations.read()).toEqual({ folderId: 'folder', id: 'reserved', at: 1_000 });
    // While this page still waits for the answer, it does not report the file itself.
    expect(await drive.client.unconfirmed()).toBeNull();
    answer(created());
    await creating;
    expect(drive.creations.read()).toBeNull();

    // A page that closed before the answer leaves the record for the next one.
    const record = memoryCreations();
    record.write({ folderId: 'folder', id: 'reserved', at: 1_000 });
    const next = fakeDrive(
      { 'GET meta': [meta()], 'GET media': [new Response(serializeBoard(board))] },
      record,
    );
    expect(await next.client.unconfirmed()).toEqual({
      file: { id: 'reserved', name: 'Plan.stormlet', version: '1' },
      board,
    });
    // It is reported until the caller has linked it.
    expect(record.read()).not.toBeNull();
    next.client.forgetUnconfirmed();
    expect([record.read(), await next.client.unconfirmed()]).toEqual([null, null]);
  });

  it('keeps looking while a late upload may still land, and drops a file elsewhere', async () => {
    const record = memoryCreations();
    record.write({ folderId: 'folder', id: 'reserved', at: 1_000 });
    const drive = fakeDrive(
      {
        'GET meta': [json({}, 404), json({}, 404), meta(['elsewhere'])],
        'GET media': [new Response(serializeBoard(board))],
      },
      record,
    );
    expect(await drive.client.unconfirmed()).toBeNull();
    expect(record.read()).not.toBeNull();
    drive.later(LATE_UPLOAD + 1);
    expect(await drive.client.unconfirmed()).toBeNull();
    expect(record.read()).toBeNull();

    record.write({ folderId: 'folder', id: 'reserved', at: 1_000 });
    expect(await drive.client.unconfirmed()).toBeNull();
    expect(record.read()).toBeNull();
  });

  it('keeps the record after a failed creation, and drops it for a file not its own', async () => {
    const offline = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': Array.from({ length: CREATE_ATTEMPTS }, lost),
      'GET meta': Array.from({ length: CREATE_ATTEMPTS }, () => json({}, 404)),
    });
    const attempt = failure(offline.client.create('folder', board));
    await vi.advanceTimersByTimeAsync(CREATE_BACKOFF * 2 ** CREATE_ATTEMPTS);
    await attempt;
    expect(offline.creations.read()).toMatchObject({ id: 'reserved' });

    const other = fakeDrive({
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': [json({}, 409)],
      'GET meta': [meta()],
      'GET media': [new Response(serializeBoard(boardOf()))],
    });
    await failure(other.client.create('folder', board));
    expect(other.creations.read()).toBeNull();
  });

  it('numbers the name when the folder already has a file called that', async () => {
    const drive = fakeDrive({
      'GET list': [
        json({
          files: [
            { id: 'x', name: 'Plan.stormlet' },
            { id: 'y', name: 'Plan (2).stormlet' },
          ],
          nextPageToken: 'more',
        }),
        json({ files: [{ id: 'z', name: "Bob's plan.stormlet" }] }),
      ],
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': [json({ id: 'reserved', name: 'Plan (3).stormlet', version: '1' })],
    });
    expect(await drive.client.create("f'1", board)).toMatchObject({ name: 'Plan (3).stormlet' });
    expect(drive.bodies[0]).toContain('"name":"Plan (3).stormlet"');
    expect(drive.lists[0]).toContain("q='f\\'1' in parents and trashed = false");
    expect(drive.lists[1]).toContain('pageToken=more');
  });

  it('keeps the plain name when the folder cannot be listed', async () => {
    const drive = fakeDrive({
      'GET list': [json({}, 500)],
      'GET ids': [json({ ids: ['reserved'] })],
      'POST upload': [created()],
    });
    expect(await drive.client.create('folder', board)).toMatchObject({ name: 'Plan.stormlet' });
  });
});
