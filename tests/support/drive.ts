import type { Board } from '../../src/domain/model';
import type { BoardStore } from '../../src/domain/store';
import { applyPatches } from '../../src/domain/patch';
import { boardOf, sticky } from './boards';
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
  /** A file a creation made whose answer never reached the page. */
  const unseen = { id: null as string | null };
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
    unconfirmed: async () => {
      calls.push('unconfirmed');
      const failure = failures.shift();
      if (failure) throw new RemoteError(failure);
      const id = unseen.id;
      return id && files.has(id)
        ? { file: ref(id), board: structuredClone(files.get(id)!.board) }
        : null;
    },
    forgetUnconfirmed: () => {
      unseen.id = null;
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
  return { remote, files, calls, failures, elsewhere, unseen };
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

/** The board store underneath, as the browser's local store would be. */
export function localStore(board: Board = boardOf(sticky('a'))) {
  const store: BoardStore & { board: Board } = {
    board,
    load: () => store.board,
    apply: (patches) => {
      store.board = applyPatches(store.board, patches).board;
    },
    subscribe: () => () => {},
    watchSaved: (listener) => {
      listener(true);
      return () => {};
    },
  };
  return store;
}
