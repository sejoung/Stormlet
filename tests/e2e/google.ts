import type { BrowserContext, Page, Request, Route } from '@playwright/test';

/** A page, or every page of a browser context (tabs share one fake Google). */
type Target = Page | BrowserContext;

/** A board file in the fake Drive. */
export interface FakeFile {
  name: string;
  version: number;
  content: string;
  parents: string[];
}

export const TOKEN = 'e2e-token';

/**
 * Google's sign-in and Picker scripts, simulated in the page. Sign-in grants a token at
 * once; the Picker shows a dialog whose button picks `window.__pick[kind]`.
 */
export async function mockGoogleScripts(page: Target) {
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google = { ...window.google, accounts: { oauth2: {
        initTokenClient: (config) => ({ requestAccessToken: () => {
          const root = document.documentElement;
          root.dataset.signIns = String(Number(root.dataset.signIns || 0) + 1);
          config.callback({ access_token: '${TOKEN}', expires_in: 3600 });
        } }),
        revoke: (_token, callback) => callback({ successful: true }),
      } } };`,
    }),
  );
  await page.route('https://apis.google.com/js/api.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
      class DocsView {
        setIncludeFolders() { return this; }
        setSelectFolderEnabled(enabled) { this.folders = enabled; return this; }
        setMode() { return this; }
        setParent() { return this; }
        setMimeTypes() { return this; }
      }
      class PickerBuilder {
        setLocale() { return this; }
        setTitle(title) { this.title = title; return this; }
        setDeveloperKey() { return this; }
        setAppId() { return this; }
        setOAuthToken() { return this; }
        setOrigin() { return this; }
        addView(view) { this.view = view; return this; }
        setCallback(callback) { this.callback = callback; return this; }
        build() {
          const dialog = document.createElement('div');
          dialog.setAttribute('role', 'dialog');
          dialog.setAttribute('aria-label', this.title);
          const choose = document.createElement('button');
          choose.textContent = 'Pick';
          const kind = this.view.folders ? 'folder' : 'file';
          choose.onclick = () => this.callback({ action: 'picked', docs: [window.__pick[kind]] });
          dialog.append(choose);
          return { setVisible: () => document.body.append(dialog), dispose: () => dialog.remove() };
        }
      }
      window.google = window.google || {};
      window.google.picker = { PickerBuilder, DocsView, DocsViewMode: { LIST: 'list' }, ViewId: { DOCS: 'docs' } };
      window.gapi = { load: (_name, options) => options.callback() };
      window.__pick = { folder: { id: 'folder-1', name: 'Boards' }, file: { id: 'shared', name: 'Shared.stormlet' } };`,
    }),
  );
}

/** The parts of a `multipart/related` upload: metadata, then content. */
function multipart(request: Request): [Record<string, unknown>, string] {
  const boundary = /boundary=(.+)$/.exec(request.headers()['content-type'] ?? '')![1];
  const [meta, content] = (request.postData() ?? '')
    .split(`--${boundary}`)
    .slice(1, 3)
    .map((part) => part.slice(part.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, ''));
  return [JSON.parse(meta), content];
}

/** The Drive v3 REST API over an in-memory file map, checking the access token. */
export async function mockDrive(page: Target) {
  const files = new Map<string, FakeFile>();
  const requests: string[] = [];
  let created = 0;
  /**
   * `loseNextCreate` drops the answer to the next creation after storing the file, as a
   * lost response would; `holdNextCreate` stores it and never answers.
   */
  const faults = { loseNextCreate: false, holdNextCreate: false };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const meta = (id: string) => {
    const file = files.get(id)!;
    return {
      id,
      name: file.name,
      version: String(file.version),
      size: String(file.content.length),
    };
  };
  await page.route('https://www.googleapis.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}${url.search}`);
    if (request.headers().authorization !== `Bearer ${TOKEN}`) return reply(route, {}, 401);
    const upload = url.pathname.startsWith('/upload/');
    const id = decodeURIComponent(url.pathname.split('/files/')[1] ?? '');
    if (url.pathname.endsWith('/about'))
      return reply(route, { user: { permissionId: 'e2e-user', emailAddress: 'e2e@example.com' } });
    if (id === 'generateIds') return reply(route, { ids: [`created-${++created}`] });
    // A folder listing, as `drive.file` shows it: only files this app has.
    const parent = /^'(.+)' in parents/.exec(url.searchParams.get('q') ?? '')?.[1];
    if (parent !== undefined)
      return reply(route, {
        files: [...files]
          .filter(([, file]) => file.parents.includes(parent))
          .map(([fileId, file]) => ({ id: fileId, name: file.name })),
      });
    if (request.method() === 'POST' && upload) {
      const [metadata, content] = multipart(request);
      const newId = String(metadata.id);
      if (files.has(newId)) return reply(route, {}, 409);
      files.set(newId, {
        name: String(metadata.name),
        version: 1,
        content,
        parents: metadata.parents as string[],
      });
      if (faults.holdNextCreate) {
        faults.holdNextCreate = false;
        return new Promise<void>(() => {});
      }
      if (faults.loseNextCreate) {
        faults.loseNextCreate = false;
        return route.abort('failed');
      }
      return reply(route, meta(newId));
    }
    const file = files.get(id);
    if (!file) return reply(route, {}, 404);
    if (request.method() === 'PATCH') {
      if (url.searchParams.get('uploadType') === 'multipart') {
        const [metadata, content] = multipart(request);
        Object.assign(file, { name: metadata.name, content });
      } else file.content = request.postData() ?? '';
      file.version++;
      return reply(route, meta(id));
    }
    if (url.searchParams.get('alt') === 'media')
      return route.fulfill({ contentType: 'application/json', body: file.content });
    return reply(route, { ...meta(id), parents: file.parents });
  });
  return { files, requests, faults };
}
