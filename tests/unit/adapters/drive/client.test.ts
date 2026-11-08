import { describe, expect, it, vi } from 'vitest';
import {
  DRIVE_API,
  DRIVE_UPLOAD,
  DriveClient,
  MAX_FILE_BYTES,
  REQUEST_TIMEOUT,
  driveFileName,
} from '../../../../src/adapters/drive/client';
import { parseBoard, serializeBoard } from '../../../../src/adapters/files/stormlet-format';
import { RemoteError } from '../../../../src/domain/sync/remote';
import { boardOf, sticky } from '../../../support/boards';

interface Sent {
  url: string;
  init: RequestInit;
}

/** A fetch that answers with `replies` in order and records what was sent. */
function fakeFetch(...replies: (Response | Error)[]) {
  const sent: Sent[] = [];
  const fetcher = vi.fn(async (url: RequestInfo | URL, init: RequestInit = {}) => {
    sent.push({ url: String(url), init });
    const reply = replies.shift();
    if (!reply) throw new Error('unexpected request');
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return { fetcher: fetcher as unknown as typeof fetch, sent };
}
const json = (body: unknown, headers: Record<string, string> = {}, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const board = { ...boardOf(sticky('a')), title: 'Plan' };
const file = { id: 'f1', name: 'Plan.stormlet', version: '3' };
const reason = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (error: RemoteError) => error.reason,
  );

describe('Drive client', () => {
  it('names files after the board title', () => {
    expect(driveFileName(board)).toBe('Plan.stormlet');
    expect(driveFileName(boardOf())).toBe('My idea board.stormlet');
  });

  it('opens a board with its metadata, authorized and uncached', async () => {
    const { fetcher, sent } = fakeFetch(
      json({ id: 'f1', name: 'Plan.stormlet', version: '3', size: '120' }),
      new Response(serializeBoard(board)),
    );
    const client = new DriveClient(() => 'token', fetcher);
    expect(await client.open('f1')).toEqual({ file, board });
    expect(sent.map((request) => request.url)).toEqual([
      `${DRIVE_API}/f1?fields=id,name,version,size`,
      `${DRIVE_API}/f1?alt=media`,
    ]);
    expect(sent[0].init).toMatchObject({
      cache: 'no-store',
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('refuses files that are too large or not boards', async () => {
    const large = fakeFetch(json({ ...file, size: String(MAX_FILE_BYTES + 1) }));
    expect(await reason(new DriveClient(() => 't', large.fetcher).open('f1'))).toBe('unreadable');
    expect(large.sent).toHaveLength(1);
    const notBoard = fakeFetch(json({ ...file, size: '2' }), new Response('{}'));
    expect(await reason(new DriveClient(() => 't', notBoard.fetcher).open('f1'))).toBe(
      'unreadable',
    );
  });

  it('saves content after checking the version, guarded by a fresh ETag', async () => {
    const { fetcher, sent } = fakeFetch(
      json({ version: '3' }, { ETag: '"fresh"' }),
      json({ id: 'f1', name: 'Plan.stormlet', version: '4' }),
    );
    const client = new DriveClient(() => 'token', fetcher);
    expect(await client.save(file, board)).toEqual({ ...file, version: '4' });
    expect(sent[1].url).toBe(`${DRIVE_UPLOAD}/f1?uploadType=media&fields=id,name,version`);
    expect(sent[1].init).toMatchObject({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"fresh"' },
    });
    expect(parseBoard(String(sent[1].init.body))).toEqual(board);
  });

  it('renames the file with the content when the title changed, without an ETag', async () => {
    const { fetcher, sent } = fakeFetch(
      json({ version: '3' }),
      json({ id: 'f1', name: 'Renamed.stormlet', version: '4' }),
    );
    const client = new DriveClient(() => 'token', fetcher);
    await client.save(file, { ...board, title: 'Renamed' });
    expect(sent[1].url).toContain('uploadType=multipart');
    const headers = sent[1].init.headers as Record<string, string>;
    expect(headers['Content-Type']).toMatch(/^multipart\/related; boundary=stormlet-/);
    expect(headers).not.toHaveProperty('If-Match');
    expect(String(sent[1].init.body)).toContain('{"name":"Renamed.stormlet"}');
  });

  it('reports a changed version as a conflict without writing', async () => {
    const { fetcher, sent } = fakeFetch(json({ version: '5' }));
    expect(await reason(new DriveClient(() => 't', fetcher).save(file, board))).toBe('conflict');
    expect(sent).toHaveLength(1);
  });

  it('reads the version alone', async () => {
    const { fetcher, sent } = fakeFetch(json({ version: '9' }));
    expect(await new DriveClient(() => 't', fetcher).version('f1')).toBe('9');
    expect(sent[0].url).toBe(`${DRIVE_API}/f1?fields=version`);
  });

  it('maps statuses, network failures and a missing token to sync failures', async () => {
    const statuses = [401, 403, 404, 409, 412, 429, 500];
    const reasons = [];
    for (const status of statuses) {
      const { fetcher } = fakeFetch(json({}, {}, status));
      reasons.push(await reason(new DriveClient(() => 't', fetcher).version('f1')));
    }
    expect(reasons).toEqual([
      'auth',
      'permission',
      'missing',
      'conflict',
      'conflict',
      'network',
      'network',
    ]);
    const refused = vi.fn();
    const revoked = fakeFetch(json({}, {}, 401));
    await reason(new DriveClient(() => 'stale', revoked.fetcher, refused).version('f1'));
    expect(refused).toHaveBeenCalledExactlyOnceWith('stale');
    const offline = fakeFetch(new TypeError('Failed to fetch'));
    expect(await reason(new DriveClient(() => 't', offline.fetcher).version('f1'))).toBe('network');
    const signedOut = fakeFetch();
    expect(await reason(new DriveClient(() => null, signedOut.fetcher).version('f1'))).toBe('auth');
    expect(signedOut.sent).toEqual([]);
  });

  it('tells rate limits and a full Drive apart from refusals', async () => {
    const forbidden = (reason?: string) =>
      json(reason ? { error: { code: 403, errors: [{ reason }] } } : 'not json', {}, 403);
    const answers = [
      forbidden('userRateLimitExceeded'),
      forbidden('rateLimitExceeded'),
      forbidden('storageQuotaExceeded'),
      forbidden('insufficientFilePermissions'),
      forbidden(),
    ];
    const results = [];
    for (const answer of answers) {
      const { fetcher } = fakeFetch(answer);
      results.push(
        await new DriveClient(() => 't', fetcher)
          .version('f1')
          .catch((error: RemoteError) => `${error.reason}: ${error.message}`),
      );
    }
    expect(results).toEqual([
      'network: Drive answered 403 (userRateLimitExceeded).',
      'network: Drive answered 403 (rateLimitExceeded).',
      'full: Drive answered 403 (storageQuotaExceeded).',
      'permission: Drive answered 403 (insufficientFilePermissions).',
      'permission: Drive answered 403.',
    ]);
  });

  it('gives up on a request that does not answer in time', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = ((_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal!.addEventListener('abort', () => reject(new DOMException('aborted'))),
        )) as unknown as typeof fetch;
      const result = new DriveClient(() => 't', fetcher).version('f1').catch((e) => e);
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT);
      const error = (await result) as RemoteError;
      expect([error.reason, error.message]).toEqual(['network', 'Drive did not answer in time.']);
    } finally {
      vi.useRealTimers();
    }
  });
});
