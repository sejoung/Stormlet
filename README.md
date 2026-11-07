# Stormlet

A local-first sticky note board for exploring and organizing ideas. [한국어](README.ko.md)

Runs in the browser with no sign-in or server. Boards live in browser storage and in readable `.stormlet` JSON files. It follows the structure of [Maplet](https://github.com/sejoung/Maplet).

## Features

- Floating board actions, a compact creation toolbar and a contextual toolbar beside selected notes
- Create a 160 × 160 square note with the note tool or `N`, then click the board and start typing
- Add a note at the center or enter multiple notes at once from the creation toolbar
- Click the note or connection tool to open a side panel for default note color and line style; preferences survive reloads
- Change individual note colors using the contextual toolbar, with sixteen colors available
- Type into a selection or double-click/press Enter to edit; Enter/Escape finishes, Shift+Enter adds a newline, with IME-safe input
- Drag the background to select; Space+drag or the hand tool pans. Use `N` for notes, `V` for select, `H` for hand
- Whole-note bold/italic/underline, alignment, auto/manual font sizes, square and rectangular notes
- Duplicate with Ctrl/Cmd+D or Alt/Option+drag; copy/cut/paste preserves styles and groups
- Connect notes with `L` or drag a side port; attached arrows follow moves and resizing
- Straight, smoothly rounded elbow (default) and curved connections, arrowheads, color/width/dashes, labels, endpoint reattachment and locking
- Copy or duplicate a flow with its internal connections; deleting a note also removes its incident lines, all undoable
- Create transparent or colored frames with `F` and a drag, or wrap selected notes using “프레임 만들기”; choose horizontal or vertical lane presets
- Rename frame titles with a double-click, resize the boundary, and move, duplicate or copy its contained notes, nested frames and internal connections together
- Frame deletion keeps the contents; cutting transfers the whole frame and contents, and frame locking leaves individual notes editable
- Adjust frame borders from 1 to 8px; connect frames to other frames or notes using the connection tool or side ports
- Right-click empty canvas, frames or connections for context actions; add and paste at the cursor, undo/redo, select notes and fit the board
- Bulk entry and spreadsheet paste (up to 50 rows × 100 columns, 3,000 characters per note)
- Align, distribute and arrange notes in a grid; alignment guides, grouping and locking
- Toggle emoji reactions and search note contents
- Right-click a note for front/back ordering, size presets, exact width and height, editing and deletion (also Shift+F10)
- Resize using the selected note's bottom-right handle or arrow keys; text automatically fits the note, without a type label
- Zoom with the wheel or bottom-right controls; fit all or selected notes with Alt/Option+1/2
- Undo and redo (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`)
- Autosave in the browser, synced across tabs of the same browser
- Double-click the board title to rename it (also Enter/F2); the title is autosaved and used as the download filename
- Version 8 `.stormlet` files retain the title, notes, connections, frames and their styles; versions 1–7 remain readable
- Keyboard help, responsive controls and dark mode

Reactions toggle using a stable local identifier without a visible profile. Same-browser tab synchronization includes the board title.

## Development

Requires Node 24.

```sh
npm install
npm run dev      # http://127.0.0.1:5173
npm run verify   # format, lint, types, tests with coverage, build
```

Playwright E2E tests run in real Chromium, covering frames, connections, context menus, text editing, dark mode and narrow layouts.

```sh
npm run test:e2e:install  # Install Chromium once
npm run test:e2e          # Run all E2E tests
npm run test:e2e:headed   # Run with a visible browser
npm run test:e2e:ui       # Open Playwright UI mode
```

The test server starts on port 4173 and shuts down automatically. Find the HTML report at `playwright-report/index.html` and screenshots under `test-results/e2e`. Failed tests retain traces and videos. CI also runs the E2E suite.

Design decisions are in [docs/adr](docs/adr). The model is built so a CRDT store can replace local storage later ([ADR 0002](docs/adr/0002-collaboration-ready-model.md)).

## License

MIT
