# Stormlet

A local-first sticky note board for exploring and organizing ideas. [한국어](README.ko.md)

Runs in the browser with no sign-in or server. Boards live in browser storage and in readable `.stormlet` JSON files. It follows the structure of [Maplet](https://github.com/sejoung/Maplet).

## Features

- Board actions across the top, a combined interaction tool and sticky palette on the left
- Drag a colored sticky from the palette onto the board, preview its position and start typing
- Also add notes by picking a color and clicking the board or using the center-add button
- Eight free colors by default; an optional event storming palette adds domain event, command, actor, policy, aggregate, read model, external system and hotspot (keys `1`–`8`)
- Double-click or press Enter to edit; drag a note to move it, drag the background to pan, Shift+drag or Shift+click to multi-select
- Right-click a note for front/back ordering, size presets, exact width and height, editing and deletion (also Shift+F10)
- Resize using the selected note's bottom-right handle or arrow keys; text automatically fits the note, without a type label
- Zoom with the wheel or bottom-right controls
- Undo and redo (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`)
- Autosave in the browser, synced across tabs of the same browser
- Open and save `.stormlet` files with note dimensions; version 1 and 2 boards import with their original sizes, colors and roles

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
