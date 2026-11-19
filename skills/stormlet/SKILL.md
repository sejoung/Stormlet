---
name: stormlet
description: Create Stormlet boards as .stormlet files — KPT and other retrospectives, brainstorming and idea grouping, event storming, user story maps, meeting and workshop boards, and system, server, cloud or Kubernetes architecture diagrams with icons and nested boundaries, including diagrams drawn from docker-compose, Kubernetes manifests or Terraform — and read or edit existing .stormlet boards to summarize them or turn them into documents, plans or code. Use when the user asks for a board, sticky notes, a retro, a workshop canvas or an editable architecture diagram, or mentions Stormlet or a .stormlet file (포스트잇, 보드, 회고, KPT, 브레인스토밍, 아이디어 정리, 이벤트 스토밍, 아키텍처, 구성도, 쿠버네티스).
---

# Stormlet boards

[Stormlet](https://sejoung.github.io/Stormlet/) is a free sticky-note board that runs in the browser. A board is a `.stormlet` file: readable JSON. You write the **content and structure** — frames, notes, lines — and usually leave out coordinates. When the user opens a draft, Stormlet lays it out.

## Make a board

1. **Plan the structure.** Each frame is one group, column or stage. Each note holds one idea. Lines show a flow or a dependency. Use the user's language for all text.
2. **Write the file** in the format below, with `"version": 13` and normally no `x`/`y`. Give every note and frame a short unique `id`, such as `k1` or `keep`, and set `frame` on each note that belongs to a frame (and on each frame that sits inside another frame).
3. **Check it** against the checklist at the end of this file. For complex connected boards, open/render in Stormlet when possible and inspect a readable zoom: labels, branches and arrowheads should be clear. Widen the layout or separate supporting notes when lines become hard to follow; do not merely shrink text.
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

Prefer automatic flow layouts with generous spacing. Use explicit positions for a deliberate event timeline or lanes when automatic placement obscures branches. Stormlet places unpositioned objects when the file is opened:

- **Loose text** (`"objectType": "text"` with no `frame`) is stacked at the top, as headings.
- **Frames** form one row below the headings, in file order. Frames in the row share the same height and grow to fit what they hold.
- **Loose notes** (no `frame`) form a grid below the frames.
- A frame's `layout` arranges the notes and frames inside it:
  - `"grid"`: the default, roughly square
  - `"column"`: top to bottom
  - `"row"`: left to right
  - `"flow"`: left to right along the lines, so each object sits one column right of the objects whose lines point to it
  - `"flow-down"`: the same, top to bottom, so each object sits one row below the objects whose lines point to it
- **Spacing**: the board and each frame accept `"spacing": { "gap": 80, "rankGap": 180, "crossGap": 100, "padding": 60 }`. Board values are inherited; frame values override them. `gap` controls row/grid/column spacing; `rankGap` and `crossGap` control flow spacing. Values are pixels, 0–2000. Prefer readable labels and clear arrow corridors over fitting everything on one screen.
- **Top legend**: give a root frame `"role": "legend", "layout": "row"`. It is placed above the main diagram regardless of file order, and excluded from flow ranking. Put one actual colored sticky per role in it (for example 220×120 with `fontSize: 20, autoFont: false`); never replace the swatches with a paragraph.
- **Nested frames**: a frame with `"frame": "<id>"` sits inside that frame, and is arranged like a note there.
- **Board layout**: a top-level `"layout"` (`grid`, `column`, `row`, `flow` or `flow-down`) arranges the board's frames and loose notes like a frame does, instead of the row of frames. Use `"layout": "flow"` for architecture and other diagrams that read left to right. Use `\"flow-down\"` for layered diagrams that read top to bottom, such as a Kubernetes cluster from ingress to storage.
- The order of `stickies` and `frames` in the file is the reading order wherever lines do not decide it.

To control the layout exactly, you can give `x`, `y`, `width` and `height` in board pixels. Objects with a position keep it. Mixing the two works, but leaving positions out is almost always better.

## Fields

The full reference is in [references/format.md](references/format.md). The fields used most often:

- **Note** (`stickies[]`): `id`, `text`, `color`, `frame`, `icon`. Optional: `width`/`height` (default 160×160; 80–1280 wide, 60–960 tall), `bold`, `italic`, `underline`, `textAlign` (`left`|`center`|`right`), `fontSize` (8–144, then also set `"autoFont": false`). With `"objectType": "text"`, it is a text box with no paper (default 320×100) and `textColor` sets its color; text boxes have no icon.
- **Note colors**: `yellow` (default), `orange`, `blue`, `green`, `purple`, `pink`, `red`, `gold`, `lime`, `teal`, `sky`, `violet`, `rose`, `peach`, `gray`, `white`.
- **Note icons**: shown above the note's text. `user`, `team`, `web`, `browser`, `mobile`, `desktop`, `server`, `service`, `api`, `gateway`, `load-balancer`, `network`, `database`, `cache`, `queue`, `stream`, `storage`, `files`, `cloud`, `function`, `container`, `cluster`, `auth`, `key`, `lock`, `mail`, `message`, `notification`, `search`, `analytics`, `monitoring`, `logs`, `scheduler`, `worker`, `code`, `config`, `document`, `payment`, `external`, `ai`. Kubernetes objects: `k8s-pod`, `k8s-deployment`, `k8s-replicaset`, `k8s-statefulset`, `k8s-daemonset`, `k8s-job`, `k8s-cronjob`, `k8s-service`, `k8s-ingress`, `k8s-egress`, `k8s-namespace`, `k8s-node`, `k8s-configmap`, `k8s-secret`, `k8s-volume`, `k8s-autoscaler`, `k8s-helm`, `k8s-registry`, `k8s-operator`. Icons are generic: name the product in the text, as in `"Orders DB\nPostgreSQL"`.
- **Frame** (`frames[]`): `id`, `title` (up to 100 characters), `frame` (the frame it sits in), `layout` (`grid` (default), `column`, `row`, `flow`, `flow-down`), `color` (`none` (default), `gray`, `blue`, `green`, `yellow`, `pink`, `purple`).
- **Line** (`connections[]`): `from`, `to` (the `id` of a note or a frame), `label`. Optional: `color` (`slate` (default), `black`, `blue`, `red`, `green`, `purple`), `path` (`elbow` (default), `straight`, `curve`), `dashed`, `startArrow`, `endArrow` (default `true`), `width` (1, 2, 3, 4 or 6).

## Board patterns

Pick the pattern closest to the request, then adapt it. Complete example files are in `examples/`.

- **KPT retrospective** (`examples/kpt.stormlet`): frames Keep, Problem and Try with `"layout": "column"`. One color per participant, or green, pink and sky for the three columns. Add an "Actions" frame for agreed actions, each with an owner and a date.
- **Idea grouping** (`examples/ideas.stormlet`): one frame per theme, named after what its notes have in common. Add a "Next experiments" frame for what to try first.
- **Event storming** (`examples/event-storming.stormlet`; `examples/youtube-content.stormlet` for parallel collection and validation branches): use board `"layout": "flow"` and stage frames with `"layout": "flow"`, with generous spacing as above. Do not stack every stage into a narrow column. Events and their commands should read left to right, with success/failure branches separated. Keep reference notes and hotspots outside the causal chain. For large flows use explicit lanes/positions, keeping existing IDs when revising a board. Include a top `role: "legend"` frame with eight colored stickies, each named for its role. Use text prefixes such as “Actor / 액터” and “Aggregate / 애그리게이트” when useful; color alone must not carry the distinction. Follow the notation's colors:
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
  - Use `gray` for configuration, secrets and platform parts such as autoscalers.
  - For a cluster or any layered stack, use `"flow-down"` instead (`examples/kubernetes.stormlet`): ingress, then services, then workloads, then storage.
  - Add a legend when colors or icons carry meaning: a `"Legend"` frame with `"layout": "row"`, holding one small note per role.
  - When the diagram comes from code (docker-compose, Kubernetes manifests, Terraform), or should be split into C4 levels, follow [references/architecture.md](references/architecture.md).

Keep each note short, under about 80 characters: one idea, readable at a glance. Use 3 to 12 notes per frame. Split a frame that would hold more than about 20.

## Edit a board

When the user gives you a board to change:

- **Keep what is there.** Copy every existing note, frame and line with all its fields, including `x`, `y`, `z`, `width` and `height`, so nothing the user arranged moves. Keep their `id`s.
- **Add new objects without positions.** Stormlet places them as the file opens:
  - A new note with `frame` set to an existing frame goes below what that frame already holds, and the frame grows.
  - A new loose note joined by a line to an existing object goes beside it: after it when the line comes from it, before it when the line goes to it.
  - Anything else goes below the board.
- **Remove** an object by leaving it out, together with the lines to it.
- Set `"version"` to the current version (`13`), and return the whole file.

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
- Event storming has a top sticky-note legend: orange event, blue command, yellow actor, purple policy, gold aggregate, green read model, pink external system, red hotspot. Actor and aggregate use different colors.
- The JSON is valid: double quotes, no comments, no trailing commas.
