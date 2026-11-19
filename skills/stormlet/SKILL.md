---
name: stormlet
description: Create Stormlet boards as .stormlet files — KPT and other retrospectives, brainstorming and idea grouping, event storming, user story maps, meeting and workshop boards, and system or server architecture diagrams with icons and nested boundaries — and read existing .stormlet boards to summarize them or turn them into documents, plans or code. Use when the user asks for a board, sticky notes, a retro, a workshop canvas or an editable architecture diagram, or mentions Stormlet or a .stormlet file (포스트잇, 보드, 회고, KPT, 브레인스토밍, 아이디어 정리, 이벤트 스토밍, 아키텍처, 구성도).
---

# Stormlet boards

[Stormlet](https://sejoung.github.io/Stormlet/) is a free sticky-note board that runs in the browser. A board is a `.stormlet` file: readable JSON. You write the **content and structure** — frames, notes, lines — and leave out coordinates. When the user opens the file, Stormlet lays the board out.

## Make a board

1. **Plan the structure.** Each frame is one group, column or stage. Each note holds one idea. Lines show a flow or a dependency. Use the user's language for all text.
2. **Write the file** in the format below, with `"version": 13` and no `x`/`y`. Give every note and frame a short unique `id`, such as `k1` or `keep`, and set `frame` on each note that belongs to a frame (and on each frame that sits inside another frame).
3. **Check it** against the checklist at the end of this file.
4. **Deliver it.**
   - If you can create files, save it as `<board title>.stormlet` and give the user that file.
   - Otherwise, show the whole file in one ```json code block.
   - Then tell the user how to open it: open https://sejoung.github.io/Stormlet/, then **drag the file onto the board**, or copy the JSON and **paste it on the board** (Ctrl/Cmd+V). **File → Open** works too. Opening replaces the current board, and Undo brings the previous board back.

```json
{
  "format": "stormlet",
  "version": 13,
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
- **Frames** form one row below the headings, in file order. Frames in the row share the same height and grow to fit what they hold.
- **Loose notes** (no `frame`) form a grid below the frames.
- A frame's `layout` arranges the notes and frames inside it:
  - `"grid"`: the default, roughly square
  - `"column"`: top to bottom
  - `"row"`: left to right
  - `"flow"`: left to right along the lines, so each object sits one column right of the objects whose lines point to it
- **Nested frames**: a frame with `"frame": "<id>"` sits inside that frame, and is arranged like a note there.
- **Board layout**: a top-level `"layout"` (`grid`, `column`, `row` or `flow`) arranges the board's frames and loose notes like a frame does, instead of the row of frames. Use `"layout": "flow"` for architecture and other diagrams that read left to right.
- The order of `stickies` and `frames` in the file is the reading order wherever lines do not decide it.

To control the layout exactly, you can give `x`, `y`, `width` and `height` in board pixels. Objects with a position keep it. Mixing the two works, but leaving positions out is almost always better.

## Fields

The full reference is in [references/format.md](references/format.md). The fields used most often:

- **Note** (`stickies[]`): `id`, `text`, `color`, `frame`, `icon`. Optional: `width`/`height` (default 160×160; 80–1280 wide, 60–960 tall), `bold`, `italic`, `underline`, `textAlign` (`left`|`center`|`right`), `fontSize` (8–144, then also set `"autoFont": false`). With `"objectType": "text"`, it is a text box with no paper (default 320×100) and `textColor` sets its color; text boxes have no icon.
- **Note colors**: `yellow` (default), `orange`, `blue`, `green`, `purple`, `pink`, `red`, `gold`, `lime`, `teal`, `sky`, `violet`, `rose`, `peach`, `gray`, `white`.
- **Note icons**: shown above the note's text. `user`, `team`, `web`, `browser`, `mobile`, `desktop`, `server`, `service`, `api`, `gateway`, `load-balancer`, `network`, `database`, `cache`, `queue`, `stream`, `storage`, `files`, `cloud`, `function`, `container`, `cluster`, `auth`, `key`, `lock`, `mail`, `message`, `notification`, `search`, `analytics`, `monitoring`, `logs`, `scheduler`, `worker`, `code`, `config`, `document`, `payment`, `external`, `ai`. Icons are generic: name the product in the text, as in `"Orders DB\nPostgreSQL"`.
- **Frame** (`frames[]`): `id`, `title` (up to 100 characters), `frame` (the frame it sits in), `layout` (`grid` (default), `column`, `row`, `flow`), `color` (`none` (default), `gray`, `blue`, `green`, `yellow`, `pink`, `purple`).
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
- **System or server architecture** (`examples/architecture.stormlet`): `"layout": "flow"` at the top level, so requests read left to right from users to data and partners.
  - **Components** are notes of `"width": 200, "height": 120` with an icon. Use one note per deployable thing or data store, with its role on the first line and its technology on the second (`"API service\nNode.js"`).
  - **Boundaries** (cloud, region, network, subnet, cluster, team) are frames, nested with `frame`. Give a boundary `"layout": "flow"` when its parts call one another, or `"layout": "column"` for a tier of peers.
  - **Calls and data** are lines from caller to callee. Label the protocol or action (`HTTPS`, `gRPC`, `publish`). Make asynchronous lines `"dashed": true`.
  - **Colors** by role:
    - `yellow`: people and clients
    - `sky`: edge and network (CDN, gateway, load balancer)
    - `blue`: services and workers
    - `green`: data stores and caches
    - `purple`: queues and streams
    - `pink`: external systems
    - `red`: risks and open questions
  - Put clients and external systems outside the boundaries, as loose notes.

Keep each note short, under about 80 characters: one idea, readable at a glance. Use 3 to 12 notes per frame. Split a frame that would hold more than about 20.

## Read a board

When the user gives you a `.stormlet` file:

- A note belongs to the frame whose rectangle (`x`, `y`, `width`, `height`) fully contains the note's rectangle. If several frames contain it, it belongs to the smallest one.
- Read the notes in a frame top to bottom, then left to right.
- `connections` join `from` to `to`. `stickyId` and `frameId` name the objects at each end.
- A note's `icon` tells what kind of component it is, which helps when turning an architecture board into documentation or infrastructure code. A frame inside another frame is a boundary within a boundary.
- Ignore `z`, `kind`, `groupId`, `reactions` and the style fields, unless the user asks about them. Notes with the same `groupId` were grouped together by the user.

Summarize by frame, keep the user's wording, and point out hotspots (red notes) and open questions.

## Checklist

- `"format": "stormlet"` and `"version": 13` are at the top level, and `stickies` is an array (it may be empty).
- Every `id` is unique among notes and among frames, and every `frame` names an existing frame. No frame sits inside itself, directly or through other frames.
- Every `from` and `to` names an existing note or frame.
- Colors, icons, layouts and other values come from the lists above. Do not invent new ones.
- Do not set `kind`, and do not add fields that are not documented.
- The JSON is valid: double quotes, no comments, no trailing commas.
