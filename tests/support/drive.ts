import type { Board } from '../../src/domain/model';
import {
  RemoteError,
  type RemoteBoards,
  type RemoteFailure,
  type RemoteLink,
} from '../../src/domain/sync/remote';

/** An in-memory Drive: files with numbered versions, and failures queued per call. */
export function fakeDrive() {
  const files = new Map<string, { name: string; version: number; board: Board }>();
  const calls: string[] = [];
  const failures: RemoteFailure[] = [];
  const ref = (id: string) => ({
    id,
    name: files.get(id)!.name,
    version: String(files.get(id)!.version),
  });
  /** Record a call; `id` names a file that must exist, unlike a folder. */
  const call = (name: string, id: string, file = true) => {
    calls.push(`${name} ${id}`);
    const failure = failures.shift();
    if (failure) throw new RemoteError(failure);
    if (file && !files.has(id)) throw new RemoteError('missing');
  };
  const remote: RemoteBoards = {
    open: async (id) => {
      call('open', id);
      return { file: ref(id), board: structuredClone(files.get(id)!.board) };
    },
    version: async (id) => {
      call('version', id);
      return ref(id).version;
    },
    save: async (file, board) => {
      call('save', file.id);
      const stored = files.get(file.id)!;
      if (String(stored.version) !== file.version) throw new RemoteError('conflict');
      Object.assign(stored, { board: structuredClone(board), version: stored.version + 1 });
      return ref(file.id);
    },
    create: async (folder, board) => {
      call('create', folder, false);
      const id = `file${files.size + 1}`;
      files.set(id, {
        name: `${board.title ?? 'board'}.stormlet`,
        version: 1,
        board: structuredClone(board),
      });
      return ref(id);
    },
  };
  /** Someone else edits the file in Drive. */
  const elsewhere = (id: string, change: (board: Board) => Board) => {
    const stored = files.get(id)!;
    Object.assign(stored, {
      board: change(structuredClone(stored.board)),
      version: stored.version + 1,
    });
  };
  return { remote, files, calls, failures, elsewhere };
}

/** Links in memory; `elsewhere` stands in for another tab writing them. */
export function memoryLinks(link: RemoteLink | null = null) {
  const watchers = new Set<(link: RemoteLink | null) => void>();
  return {
    link,
    read() {
      return this.link;
    },
    write(next: RemoteLink | null) {
      this.link = next;
    },
    watch(listener: (link: RemoteLink | null) => void) {
      watchers.add(listener);
      return () => watchers.delete(listener);
    },
    elsewhere(next: RemoteLink | null) {
      this.link = next;
      for (const watcher of watchers) watcher(structuredClone(next));
    },
  };
}
