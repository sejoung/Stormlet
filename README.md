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

- Draw a frame with `F`, or wrap selected notes with “프레임 만들기”; horizontal and vertical lane presets
- Transparent or colored, borders from 1 to 8px, titles renamed with a double-click
- Moving, duplicating or copying a frame takes the notes, nested frames and lines inside it along
- Deleting a frame keeps its contents; locking a frame leaves the notes inside it editable

**Board**

- Pan with Space+drag, the middle mouse button or the hand tool; zoom with the wheel or on-screen controls
- Fit all notes or the selected ones (`Alt/Option+1/2`)
- Minimap of the whole board: click or drag the outline to move the view, or use the arrow keys; it stays open across reloads
- Context menus on notes, frames, lines and the empty canvas (also Shift+F10)
- Undo and redo for every change, including deletions that remove attached lines
- Autosave in the browser, synced across tabs of the same browser
- Rename the board by double-clicking its title; the title becomes the download filename
- Keyboard help (`F1` or `?`), responsive layout and dark mode

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
| Search / save file               | `Ctrl/Cmd+F` / `Ctrl/Cmd+S`       |
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

## Architecture

| Layer             | Responsibility                                                              |
| ----------------- | --------------------------------------------------------------------------- |
| `src/domain`      | Board model, patches, commands, frames, connections, `BoardStore` interface |
| `src/application` | Editing session and undo/redo built on inverse patches                      |
| `src/engine`      | Viewport, text fitting, snapping, line geometry, paste parsing, fit to view |
| `src/adapters`    | `.stormlet` file format, localStorage store, clipboard, file download       |
| `src/components`  | Canvas, notes, frames, connections, toolbars, menus, dialogs                |
| `src/app`         | Composition, session hooks, shortcuts                                       |

Dependencies point inward, from `app` towards `domain`. The rules are enforced by tests in `tests/architecture`, and lint keeps every file under 400 lines and every folder at 10 files or fewer.

Design decisions are recorded in [docs/adr](docs/adr). The model is designed so a CRDT store can replace local storage later ([ADR 0002](docs/adr/0002-collaboration-ready-model.md)).

### File format

`.stormlet` files are JSON with a `format` and `version` field. The current version is 8 and stores the title, notes, connections, frames and their styles. Files from versions 1–7 can still be opened.

## Roadmap

- Google Drive storage
- Real-time collaboration: a Yjs implementation of `BoardStore` and a relay server ([ADR 0002](docs/adr/0002-collaboration-ready-model.md))

## Contributing

Issues and pull requests are welcome. Before opening a pull request, make sure `npm run verify` and `npm run test:e2e` pass. For larger changes, open an issue first to discuss the direction.

## License

[MIT](LICENSE) © sejoung kim
