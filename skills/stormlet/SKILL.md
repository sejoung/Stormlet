---
name: stormlet
description: Create Stormlet sticky-note boards as .stormlet files — KPT and other retrospectives, brainstorming and idea grouping, event storming, user story maps, affinity maps, meeting and workshop boards — and read existing .stormlet boards to summarize them or turn them into documents, plans or code. Use when the user asks for a board, sticky notes, a retro or a workshop canvas, or mentions Stormlet or a .stormlet file (포스트잇, 보드, 회고, KPT, 브레인스토밍, 아이디어 정리, 이벤트 스토밍).
---

# Stormlet boards

[Stormlet](https://sejoung.github.io/Stormlet/) is a free sticky-note board that runs in the browser. A board is a `.stormlet` file: readable JSON. You write the **content and structure** — frames, notes, lines — and leave out coordinates. When the user opens the file, Stormlet lays the board out.

## Make a board

1. **Plan the structure.** Each frame is one group, column or stage. Each note holds one idea. Lines show a flow or a dependency. Use the user's language for all text.
2. **Write the file** in the format below, with `"version": 12` and no `x`/`y`. Give every note and frame a short unique `id`, such as `k1` or `keep`, and set `frame` on each note that belongs to a frame.
3. **Check it** against the checklist at the end of this file.
4. **Deliver it.**
   - If you can create files, save it as `<board title>.stormlet` and give the user that file.
   - Otherwise, show the whole file in one ```json code block.
   - Then tell the user how to open it: open https://sejoung.github.io/Stormlet/, then **drag the file onto the board**, or copy the JSON and **paste it on the board** (Ctrl/Cmd+V). **File → Open** works too. Opening replaces the current board, and Undo brings the previous board back.

```json
{
  "format": "stormlet",
  "version": 12,
  "title": "Sprint 12 retro",
  "frames": [
    { "id": "keep", "title": "Keep", "layout": "column" },
    { "id": "problem", "title": "Problem", "layout": "column" },
    { "id": "try", "title": "Try", "layout": "column" }
  ],
  "stickies": [
    { "id": "intro", "objectType": "text", "text": "Sprint 12 · what to keep, fix and try" },
    { "id": "k1", "frame": "keep", "color": "green", "text": "Daily deploys went smoothly" },
    { "id": "p1", "frame": "problem", "color": "pink", "text": "Reviews waited two days" },
    { "id": "t1", "frame": "try", "color": "sky", "text": "Review within one working day" }
  ],
  "connections": [{ "from": "p1", "to": "t1", "label": "fix" }]
}
```

## How Stormlet lays out a file

You never compute positions. Stormlet places everything when the file is opened:

- **Loose text** (`"objectType": "text"` with no `frame`) is stacked at the top, as headings.
- **Frames** form one row below the headings, in file order. A frame's `layout` arranges its notes: `"grid"` (the default, roughly square), `"column"` (top to bottom) or `"row"` (left to right). Frames in the row share the same height and grow to fit their notes.
- **Loose notes** (no `frame`) form a grid below the frames.
- The order of `stickies` in the file is the reading order inside each frame.

To control the layout exactly, you can give `x`, `y`, `width` and `height` in board pixels. Objects with a position keep it. Mixing the two works, but leaving positions out is almost always better.

## Fields

The full reference is in [references/format.md](references/format.md). The fields used most often:

- **Note** (`stickies[]`): `id`, `text`, `color`, `frame`. Optional: `width`/`height` (default 160×160; 80–1280 wide, 60–960 tall), `bold`, `italic`, `underline`, `textAlign` (`left`|`center`|`right`), `fontSize` (8–144, then also set `"autoFont": false`). With `"objectType": "text"`, it is a text box with no paper (default 320×100) and `textColor` sets its color.
- **Note colors**: `yellow` (default), `orange`, `blue`, `green`, `purple`, `pink`, `red`, `gold`, `lime`, `teal`, `sky`, `violet`, `rose`, `peach`, `gray`, `white`.
- **Frame** (`frames[]`): `id`, `title` (up to 100 characters), `layout` (`grid` (default), `column`, `row`), `color` (`none` (default), `gray`, `blue`, `green`, `yellow`, `pink`, `purple`).
- **Line** (`connections[]`): `from`, `to` (the `id` of a note or a frame), `label`. Optional: `color` (`slate` (default), `black`, `blue`, `red`, `green`, `purple`), `path` (`elbow` (default), `straight`, `curve`), `dashed`, `startArrow`, `endArrow` (default `true`), `width` (1, 2, 3, 4 or 6).

## Board patterns

Pick the pattern closest to the request, then adapt it. Complete example files are in `examples/`.

- **KPT retrospective** (`examples/kpt.stormlet`): frames Keep, Problem and Try with `"layout": "column"`. One color per participant, or green, pink and sky for the three columns. Add an "Actions" frame for agreed actions, each with an owner and a date.
- **Idea grouping** (`examples/ideas.stormlet`): one frame per theme, named after what its notes have in common. Add a "Next experiments" frame for what to try first.
- **Event storming** (`examples/event-storming.stormlet`): one frame per stage of the flow, with `"layout": "column"`. Lines join events in time order. Follow the notation's colors:
  - `orange`: domain event, in the past tense
  - `blue`: command
  - `yellow`: actor
  - `purple`: policy ("whenever …")
  - `gold`: aggregate
  - `green`: read model
  - `pink`: external system
  - `red`: hotspot (question or problem)
- **User story map**: one frame per activity, with `"layout": "column"`. Each frame lists its user stories from most to least important.
- **Meeting or workshop**: a text heading for the goal, one frame per agenda item, and a "Decisions" frame and an "Open questions" frame.

Keep each note short, under about 80 characters: one idea, readable at a glance. Use 3 to 12 notes per frame. Split a frame that would hold more than about 20.

## Read a board

When the user gives you a `.stormlet` file:

- A note belongs to the frame whose rectangle (`x`, `y`, `width`, `height`) fully contains the note's rectangle. If several frames contain it, it belongs to the smallest one.
- Read the notes in a frame top to bottom, then left to right.
- `connections` join `from` to `to`. `stickyId` and `frameId` name the objects at each end.
- Ignore `z`, `kind`, `groupId`, `reactions` and the style fields, unless the user asks about them. Notes with the same `groupId` were grouped together by the user.

Summarize by frame, keep the user's wording, and point out hotspots (red notes) and open questions.

## Checklist

- `"format": "stormlet"` and `"version": 12` are at the top level, and `stickies` is an array (it may be empty).
- Every `id` is unique among notes and among frames, and every `frame` names an existing frame.
- Every `from` and `to` names an existing note or frame.
- Colors and other values come from the lists above. Do not invent new ones.
- Do not set `kind`, and do not add fields that are not documented.
- The JSON is valid: double quotes, no comments, no trailing commas.
