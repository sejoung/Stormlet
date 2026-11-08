# Stormlet

[![Quality](https://github.com/sejoung/Stormlet/actions/workflows/ci.yml/badge.svg)](https://github.com/sejoung/Stormlet/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node 24](https://img.shields.io/badge/node-24-339933?logo=nodedotjs&logoColor=white)
![React 19](https://img.shields.io/badge/react-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-5.9-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/vite-7-646cff?logo=vite&logoColor=white)
![Tested with Vitest and Playwright](https://img.shields.io/badge/tested%20with-Vitest%20%2B%20Playwright-6e9f18)

A local-first sticky note board for exploring and organizing ideas. [한국어](README.ko.md)

Stormlet runs entirely in the browser, with no sign-in and no server. Boards are autosaved to browser storage and can be downloaded as `.stormlet` files, which are plain, readable JSON.

## Features

**Notes**

- Create a note with the note tool or `N`, click the board and start typing (160 × 160 square by default)
- Add a note at the center, or enter many notes at once with bulk entry
- Paste cells from Excel or Google Sheets (up to 50 rows × 100 columns, 3,000 characters per note)
- Sixteen colors, whole-note bold/italic/underline, text alignment, square and rectangular shapes
- Text automatically fits the note and never scrolls; a manually chosen font size is kept while the text fits, and sizes that would overflow are disabled
- IME-safe editing: type into a selection, double-click or press Enter; Enter/Escape finishes and Shift+Enter adds a newline
- Resize with the bottom-right handle (or its arrow keys), presets or an exact width and height
- Align, distribute and arrange in a grid, with alignment guides while dragging; group and lock
- Emoji reactions and full-text search

**Connections**

- Connect notes and frames with `L` or by dragging a side port; lines follow moves and resizing
- Straight, rounded elbow (default) and curved lines with arrowheads, color, width, dashes, labels and locking
- Drag an endpoint to reattach it; copying or duplicating a flow keeps its internal lines

**Frames**

- Draw a frame with `F`, or wrap selected notes with “Create frame”; horizontal and vertical lane presets
- Transparent or colored, borders from 1 to 8px, titles renamed with a double-click
- Moving, duplicating or copying a frame takes the notes, nested frames and lines inside it along
- Deleting a frame keeps its contents; locking a frame leaves the notes inside it editable

**Board**

- Pan with Space+drag, the middle mouse button or the hand tool; zoom with the wheel or on-screen controls
- Fit all notes or the selected ones (`Alt/Option+1/2`)
- Minimap of the whole board: click or drag the outline to move the view, or use the arrow keys; it stays open across reloads
- Context menus on notes, frames, lines and the empty canvas (also Shift+F10)
- Undo and redo for every change, including deletions that remove attached lines
- Autosave in the browser, a board for each tab: a new board opens in a new tab, coming back resumes the last board, and boards of closed tabs stay under File → Recent boards ([ADR 0011](docs/adr/0011-board-per-tab.md))
- Optional Google Drive sync, the main place for boards once connected: a Drive button in the toolbar connects and saves, the chosen folder is shared by every tab so new boards go there with their first edit, and `Ctrl/Cmd+S` saves to Drive; edits are saved automatically and changes made elsewhere are merged, with a choice only for real conflicts ([setup](docs/google-drive.md))
- Rename the board by double-clicking its title; the title becomes the download filename
- A menu bar under the title, listing each command with its shortcut: File (new board, recent boards, open, download, Google Drive), Edit (undo, clipboard, duplicate, delete, select all, group, lock, search), View (zoom, fit, minimap) and Settings (language, keyboard help, troubleshooting)
- Keyboard help (`F1` or `?`), responsive layout and dark mode
- English and Korean interface: follows the browser language (English when it is not supported) and can be changed in Settings
- Built-in diagnostics: a recovery screen instead of a blank page after a crash, a warning when the browser stops saving, a damaged save kept aside rather than overwritten, and a copyable report for bug reports

Reactions use a stable local identifier, so no profile is shown.

## Keyboard shortcuts

| Action                           | Shortcut                          |
| -------------------------------- | --------------------------------- |
| Note / select / hand tool        | `N` / `V` / `H`                   |
| Connection / frame tool          | `L` / `F`                         |
| Edit note, newline, finish       | `Enter`, `Shift+Enter`, `Esc`     |
| Duplicate                        | `Ctrl/Cmd+D`, `Alt/Option+drag`   |
| Duplicate in a direction         | `Alt/Option+arrow`                |
| Select all                       | `Ctrl/Cmd+A`                      |
| Group / ungroup                  | `Ctrl/Cmd+G` / `Ctrl/Cmd+Shift+G` |
| Lock                             | `Ctrl/Cmd+Shift+L`                |
| Bold / italic / underline        | `Ctrl/Cmd+B` / `I` / `U`          |
| Move selection (10px with Shift) | Arrow keys                        |
| Undo / redo                      | `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` |
| Fit all / fit selected           | `Alt/Option+1` / `2`              |
| Search                           | `Ctrl/Cmd+F`                      |
| Open a board file / save         | `Ctrl/Cmd+O` / `Ctrl/Cmd+S`       |
| Help                             | `F1`, `?`                         |

## Getting started

Requires Node 24 (see [`.nvmrc`](.nvmrc)).

```sh
git clone https://github.com/sejoung/Stormlet.git
cd Stormlet
npm install
npm run dev      # http://127.0.0.1:5173
```

`npm run build` writes a static site to `dist/` with relative paths, so it can be served from any static host or subfolder.

Google Drive is optional: copy `.env.example` to `.env.local` and fill in the three public Google values to enable it. See [docs/google-drive.md](docs/google-drive.md) for the Google Cloud setup.

## Scripts

| Script             | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `npm run dev`      | Start the dev server                                            |
| `npm run build`    | Type-check and build to `dist/`                                 |
| `npm run verify`   | Format check, lint, type check, unit tests with coverage, build |
| `npm test`         | Run unit tests (Vitest, jsdom)                                  |
| `npm run test:e2e` | Run E2E tests (Playwright, Chromium)                            |
| `npm run arch`     | Report on layer dependency rules                                |
| `npm run format`   | Format with Prettier                                            |

### E2E tests

Playwright runs the E2E suite in real Chromium, covering notes and text fitting, frames, connections, context menus, dark mode and narrow layouts.

```sh
npm run test:e2e:install  # Install Chromium once
npm run test:e2e          # Run all E2E tests
npm run test:e2e:headed   # Run with a visible browser
npm run test:e2e:ui       # Open Playwright UI mode
```

The test server starts on port 4173 and stops when the tests finish. The HTML report is written to `playwright-report/index.html` and screenshots to `test-results/e2e`. Failed tests keep traces and videos. CI runs `verify` and the E2E suite on every push and pull request.

### Deploying (GitHub Pages)

Stormlet needs no backend: boards stay in the browser, and the browser reads and writes Drive files through Google's APIs itself.

1. In **Settings → Pages**, set Source to **GitHub Actions**.
2. For Google Drive, add `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY` and `VITE_GOOGLE_APP_ID` under **Settings → Secrets and variables → Actions → Variables**. They are public settings, so plain variables will do. Without them the site is deployed without Drive, with a warning in the run. Register the deployed origin (`https://<account>.github.io`) in Google Cloud ([setup](docs/google-drive.md)).
3. Run **Actions → Pages → Run workflow** by hand. It deploys only after `verify` and the E2E tests pass.

## Architecture

| Layer             | Responsibility                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `src/domain`      | Board model, patches, commands, frames, connections, `BoardStore` interface                          |
| `src/application` | Editing session, undo/redo built on inverse patches, Google Drive sync                               |
| `src/engine`      | Viewport, text fitting, snapping, line geometry, paste parsing, fit to view                          |
| `src/adapters`    | `.stormlet` file format, localStorage store, Google Drive, clipboard, file download, diagnostics log |
| `src/components`  | Canvas, notes, frames, connections, toolbars, menus, dialogs                                         |
| `src/app`         | Composition, session hooks, shortcuts                                                                |
| `src/i18n`        | Message catalogs per language and the translate function                                             |

Dependencies point inward, from `app` towards `domain`. The rules are enforced by tests in `tests/architecture`, and lint keeps every file under 400 lines and every folder at 10 files or fewer.

Design decisions are recorded in [docs/adr](docs/adr). The model is designed so a CRDT store can replace local storage later ([ADR 0002](docs/adr/0002-collaboration-ready-model.md)).

### File format

`.stormlet` files are JSON with a `format` and `version` field. The current version is 8 and stores the title, notes, connections, frames and their styles. Files from versions 1–7 can still be opened.

### Translations

UI text lives in one file per language under [`src/i18n/locales`](src/i18n/locales); code refers to it by key, such as `t('toolbar.undo')`. `en.ts` defines every key and is the fallback. To add a language, copy `en.ts` to `<code>.ts`, translate the values (keep `{placeholders}`), and list the language in `LOCALES` and the catalog map in [`src/i18n/messages.ts`](src/i18n/messages.ts). Type checking and tests catch missing keys or placeholders. Generated board and frame titles stay English in every language ([ADR 0008](docs/adr/0008-i18n.md)).

## Roadmap

- Real-time collaboration: a Yjs implementation of `BoardStore` and a relay server ([ADR 0002](docs/adr/0002-collaboration-ready-model.md))

## Reporting a bug

Open **Settings → Troubleshooting → Copy diagnostics** and paste the result into a [GitHub issue](../../issues/new?template=bug_report.md). The report holds the app version, browser, board size, storage use and recent log entries (errors, failed saves, and so on), never the text of your notes. The same entries are also written to the browser console with a `[stormlet]` prefix ([ADR 0009](docs/adr/0009-diagnostics.md)).

## Contributing

Issues and pull requests are welcome. Before opening a pull request, make sure `npm run verify` and `npm run test:e2e` pass. For larger changes, open an issue first to discuss the direction.

## License

[MIT](LICENSE) © sejoung kim
