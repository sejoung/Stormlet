import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CREATE_ATTEMPTS,
  CREATE_BACKOFF,
  DRIVE_UPLOAD,
  DriveClient,
} from '../../../../src/adapters/drive/client';
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
function fakeDrive(script: Record<string, (Response | Error)[]>) {
  const log: string[] = [];
  const bodies: string[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
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
    const reply = script[key]?.shift();
    if (!reply) throw new Error(`unexpected ${key}`);
    if (reply instanceof Error) throw reply;
    return reply;
  }) as unknown as typeof fetch;
  return { client: new DriveClient(() => 'token', fetcher), log, bodies };
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
});
