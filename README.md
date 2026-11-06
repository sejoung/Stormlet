# Stormlet

A local-first sticky note board for exploring and organizing ideas. [한국어](README.ko.md)

Runs in the browser with no sign-in or server. Boards live in browser storage and in readable `.stormlet` JSON files. It follows the structure of [Maplet](https://github.com/sejoung/Maplet).

## Features

- Board actions across the top, selection, pan and sticky tools on the left
- Drag a colored sticky from the palette onto the board, preview its position and start typing
- Also add notes by picking a color and clicking the board, double-clicking empty space, or using the center-add button
- Eight free colors by default; an optional event storming palette adds domain event, command, actor, policy, aggregate, read model, external system and hotspot (keys `1`–`8`)
- Double-click or press Enter to edit; drag to move (grid snapping), marquee or Shift+click to multi-select, Delete to remove
- Select (`V`), pan (`H`), and zoom with the wheel or bottom-right controls
- Undo and redo (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`)
- Autosave in the browser, synced across tabs of the same browser
- Open and save `.stormlet` files, preserving original colors and roles when importing version 1 boards

## Development

Requires Node 24.

```sh
npm install
npm run dev      # http://127.0.0.1:5173
npm run verify   # format, lint, types, tests with coverage, build
```

Design decisions are in [docs/adr](docs/adr). The model is built so a CRDT store can replace local storage later ([ADR 0002](docs/adr/0002-collaboration-ready-model.md)).

## License

MIT
