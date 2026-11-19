# The .stormlet format

A `.stormlet` file is UTF-8 JSON, at most 20 MB. This page covers version 12, the version to write. Stormlet reads every version from 1 to 12. It refuses files from a newer version, and files with an invalid field.

```json
{
  "format": "stormlet",
  "version": 12,
  "title": "Board title",
  "frames": [],
  "stickies": [],
  "connections": []
}
```

| Field         | Required | Notes                                                             |
| ------------- | -------- | ----------------------------------------------------------------- |
| `format`      | yes      | Always `"stormlet"`                                               |
| `version`     | yes      | `12`                                                              |
| `title`       | no       | The board name and the download file name. Single line.           |
| `stickies`    | yes      | Notes, text boxes and drawings, from bottom to top. May be empty. |
| `frames`      | no       | Frames that group notes                                           |
| `connections` | no       | Lines between notes and frames                                    |

## Drafts and saved files

In version 12, positions, sizes and most style fields are optional. A file that leaves them out is a **draft**: Stormlet lays it out when the file is opened, and then saves it with every field filled in. A file Stormlet saved therefore always has `x`, `y`, `z`, `width` and `height` on every object. Both forms are valid; when you write a new board, write a draft.

## Notes: `stickies[]`

| Field                         | Default in a draft                | Values                                                                                                                                                                  |
| ----------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                          | required                          | A unique non-empty string. Not `__proto__`, `constructor` or `prototype`.                                                                                               |
| `text`                        | `""`                              | Up to 3,000 characters. `\n` starts a new line.                                                                                                                         |
| `color`                       | `"yellow"`                        | `yellow`, `orange`, `blue`, `green`, `purple`, `pink`, `red`, `gold`, `lime`, `teal`, `sky`, `violet`, `rose`, `peach`, `gray`, `white`                                 |
| `frame`                       | none                              | The `id` of the frame to place the note in. Draft only. It is ignored when the note has a position, and a note naming no existing frame is placed with the loose notes. |
| `objectType`                  | none                              | Omit for a sticky note. `"text"` makes a text box with no paper. Do not write `"drawing"`; pen drawings are made in the app.                                            |
| `x`, `y`                      | laid out                          | The top-left corner in board pixels. Give both, or neither.                                                                                                             |
| `z`                           | after the highest given           | Stacking order; a higher `z` draws on top.                                                                                                                              |
| `width`, `height`             | 160 × 160 (text: 320 × 100)       | Note: 80–1280 wide and 60–960 tall. Text: at least 16 × 16.                                                                                                             |
| `kind`                        | `null`                            | Legacy field. Omit it, or write `null`.                                                                                                                                 |
| `bold`, `italic`, `underline` | `false`                           | Apply to the whole note                                                                                                                                                 |
| `textAlign`                   | `"center"` (text boxes: `"left"`) | `left`, `center`, `right`                                                                                                                                               |
| `autoFont`                    | `true`                            | When `true`, the font size fits the note                                                                                                                                |
| `fontSize`                    | automatic                         | 8–144. Set `"autoFont": false` with it.                                                                                                                                 |
| `textColor`                   | `"default"`                       | Text boxes only: `default`, `black`, `gray`, `red`, `orange`, `green`, `blue`, `purple`                                                                                 |
| `groupId`                     | none                              | Notes with the same `groupId` move and are selected together. 1–128 characters: letters, digits, `_` and `-`.                                                           |
| `locked`                      | `false`                           | A locked note cannot be moved or edited                                                                                                                                 |
| `reactions`                   | none                              | `[{ "emoji": "👍", "people": ["Mina"] }]`, at most 16 emoji                                                                                                             |

## Frames: `frames[]`

| Field             | Default in a draft | Values                                                                            |
| ----------------- | ------------------ | --------------------------------------------------------------------------------- |
| `id`              | required           | Unique among frames                                                               |
| `title`           | `"Frame"`          | 1–100 characters. Shown above the frame.                                          |
| `layout`          | `"grid"`           | How the frame's notes are placed: `grid`, `column` or `row`. Draft only.          |
| `color`           | `"none"`           | `none`, `gray`, `blue`, `green`, `yellow`, `pink`, `purple`                       |
| `borderWidth`     | `2`                | 1, 2, 3, 4, 6 or 8                                                                |
| `x`, `y`          | laid out           | The top-left corner. A frame with a position keeps it.                            |
| `width`, `height` | fits its notes     | 160–20000 wide and 120–20000 tall. A frame grows to fit the notes placed into it. |
| `locked`          | `false`            | A locked frame cannot be moved, but its notes stay editable                       |

A note belongs to a frame when the frame's rectangle fully contains the note's rectangle. Membership is not stored. A frame may sit inside a larger frame.

## Lines: `connections[]`

| Field                    | Default in a draft    | Values                                             |
| ------------------------ | --------------------- | -------------------------------------------------- |
| `id`                     | `line-1`, `line-2`, … | Unique among lines                                 |
| `from`, `to`             | required              | An end, as described below                         |
| `label`                  | `""`                  | Up to 300 characters, shown on the line            |
| `path`                   | `"elbow"`             | `elbow`, `straight`, `curve`                       |
| `color`                  | `"slate"`             | `slate`, `black`, `blue`, `red`, `green`, `purple` |
| `width`                  | `2`                   | 1, 2, 3, 4 or 6                                    |
| `dashed`                 | `false`               |                                                    |
| `startArrow`, `endArrow` | `false`, `true`       |                                                    |
| `locked`                 | `false`               |                                                    |

Each end is written in one of these forms:

- `"k1"`: in a draft, the `id` of a note, or of a frame when no note has that `id`. The line attaches to the side nearest the other end.
- `{ "stickyId": "k1", "side": "right" }` or `{ "frameId": "keep", "side": "auto" }`: `side` is `auto`, `top`, `right`, `bottom` or `left`. It may be left out in a draft, and then it is `auto`.
- `{ "x": 100, "y": 40 }`: a free end at a board position.

A line whose note or frame does not exist is left out. The rest of the board still opens.

## Layout of a draft

When a file is opened, Stormlet places the objects that have no position:

1. It starts at the top left, or below the objects that do have a position.
2. Loose text boxes are stacked first, as headings.
3. Frames without a position follow in one row, in file order, 80 px apart. Their notes are placed inside them with 40 px padding, in a uniform grid as large as the largest note. Frames that give no height share the height of the tallest frame in the row.
4. Loose notes go in a grid below the row.
5. Notes keep their file order. Unordered notes are stacked above the highest given `z`.

The same file always opens the same way.
