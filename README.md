# Figr — Frontend Engineer Assignment

Role and brief: [doc.figr.design/frontend-engineer](https://doc.figr.design/frontend-engineer) · Submit: [join.figr.design/r/kdqVkj](https://join.figr.design/r/kdqVkj)

## Setting

You're building the viewer for a design tool. A board shows live previews of web pages. Each preview is an `<iframe>` showing a page served from a **different origin** than your app. Users point at elements inside any preview. Your app, the page that contains the previews (the "host"), draws the outlines and labels on top of each preview. It also shows a layers panel and an inspector for whatever is selected.

Use any framework, language, library, AI tool or workflow you like.

## What's in this kit

```
backend/
  server.js        mock API (:4000) and page server (:4001), no dependencies
  data/            screens.json, elements.json
  pages/           the preview pages
frontend/
  report.js        error reporter stub
```

Run the backend with Node 18+:

```
npm run backend
```

- **Pages** at `http://localhost:4001`: `page-1.html` to `page-6.html`, plus `page-6-next.html`, which page 6 links to. You may add **one `<script>` tag** to each page. You may not change anything else in them.
- **API** at `http://localhost:4000`. Every route accepts `?latency=<ms>&fail=<0..1>`. A failed request returns either a 5xx or a 200 with a malformed body.
  - `GET /screens` returns `[{ id, name, url }]`: 24 screens, which reuse the 6 pages.
  - `GET /elements/:key` returns `{ component, description, status, owner }` for elements that carry a `data-key` attribute. It returns `404` when there are no details for that key.
- **`report(error, context)`** in `frontend/report.js`: a stub error reporter that logs every call.

Build your app in `frontend/`, or anywhere else in the repo.

## Terms

- **Preview**: one iframe on the board.
- **Element**: any element inside a preview's page except `<html>` and `<body>`.
- **Active preview**: the preview the user last clicked in Select mode. The layers panel and inspector show the active preview.
- **Name**: an element's `data-name` if it has one, otherwise tag plus first class (`button.primary`) or tag plus id (`div#hero`), otherwise the tag alone.

## Requirements

### R1: Board

1. Show every screen from `GET /screens` as a preview, 1280×800 each, in a grid, with the screen name above it.
2. Dragging empty board space pans the board. The wheel over empty board space pans too.
3. **Ctrl/Cmd + wheel** zooms the board from 25% to 400%, centred on the pointer. This works **wherever the pointer is, including over a preview**.
4. The wheel over a preview scrolls that page, in both modes.
5. Two modes, switched from a toolbar toggle and the **V** key (Select) and **I** key (Interact):
   - **Select mode** (default): clicks select elements and never reach the page. Links don't navigate, buttons don't act, inputs don't get focus, forms don't submit.
   - **Interact mode**: the page behaves normally and no outlines are drawn.
     - The selection is kept but hidden, and it reappears when switching back to Select mode if the elements still exist.
     - The layers panel keeps updating as the page changes.

### R2: Hover (Select mode)

1. When the pointer is over an element, draw a **1px outline** exactly on that element's box, with a label showing its name.
2. Only one element on the whole board is hovered at a time.
3. Hover clears when the pointer leaves the preview or the window, or when the board starts panning or zooming.
4. **Every** element can be hovered and selected, including disabled buttons and inputs, images, SVG, and elements under a sticky header.
5. Page background (`<html>` / `<body>`) is never hovered. Pointing at it shows nothing.

### R3: Selection

1. Clicking selects the element under the pointer. Selected elements get a **2px outline** in a different colour from hover, plus a label.
2. **Shift + click** adds or removes an element in the same preview. Shift + click in a different preview replaces the selection with that element.
3. **Escape**, clicking page background, or clicking empty board space clears the selection.
4. Outlines and labels:
   - stay glued to their element while the user pans, zooms, scrolls inside the page (including scroll areas inside the page), resizes the window, or the element changes size or moves;
   - stay 1px or 2px thick and keep the same label size at every zoom level;
   - are clipped to the preview's edges. An element scrolled fully out of view has no outline but stays selected;
   - put the label below the element when there's no room above it inside the preview.
5. **Keyboard.** When several elements are selected, each of these keys acts on the most recently selected one and replaces the selection with the result.
   - **Enter** selects the first child.
   - **Shift + Enter** selects the parent. Nothing happens at the top level.
   - **Tab / Shift + Tab** selects the next or previous sibling, wrapping around.
6. **All shortcuts** (V, I, Escape, Enter, Tab, and so on) work even right after the user clicked inside a preview.
7. **The page re-renders itself:**
   - A selected element that still exists stays selected, even if the page rebuilt its DOM nodes or inserted new siblings before it.
   - A selected element that no longer exists is removed from the selection. If nothing remains selected, the inspector says **"This element no longer exists"** until the next selection.
   - The selection must never jump to a different element. If your approach can't guarantee this in some case, say which case in your README.
8. **A page navigates** (a link followed in Interact mode):
   - That preview's selection clears.
   - Select mode works on the new page with no reload of the board.
   - The layers panel shows the new page.

### R4: Layers panel

1. It shows the element tree of the active preview. With no active preview, it shows "Click something in a preview".
2. Each row shows indentation, the element's name, and a chevron if the element has children. Top-level rows are the children of `<body>`.
3. **Children load when a row is first expanded.** While loading, the row shows a loading state. If the page doesn't answer within 3 seconds, the row shows "Couldn't load" with a retry on that row only.
   - Collapsing and re-expanding a row, including while it's still loading, must never produce duplicate or missing children.
4. **Hover sync, both directions:**
   - Hovering a row draws the hover outline on that element in the preview.
   - Hovering an element in the preview highlights its row. If that row is inside a collapsed parent, highlight the nearest visible ancestor row instead. Hover never expands anything.
5. **Selection sync, both directions:**
   - Clicking a row selects that element.
   - Selecting an element in the preview expands every ancestor of its row (loading them if needed, even many levels deep), highlights the row, and scrolls the panel to show it.
6. Clicking a row whose element is out of view inside the page scrolls **only that page** to show the element. The board and the host page don't move.
7. **Multi-select:** Shift + click on a row adds or removes it, and all selected rows are highlighted.
8. **Keyboard while the panel has focus:**
   - **↑ / ↓** select the previous or next visible row.
   - **→** expands a row, or moves to its first child if it's already expanded.
   - **←** collapses a row, or moves to its parent if it's already collapsed.
9. **Expanded rows and panel scroll position are remembered per preview.** Switching the active preview to B and back to A restores A exactly as it was left, until A's page navigates or the board reloads.
10. **When the page changes its own DOM, the tree updates to match:**
    - Rows that still exist keep their expanded state and selection.
    - Removed rows disappear, and a removed hovered row clears the hover.
    - Rows the user is looking at don't jump. The scroll position holds steady.
11. **Search box:**
    - Typing shows only rows whose name contains the text, together with their ancestors.
    - Search covers the whole tree, including rows never loaded.
    - Clearing the search restores exactly the expanded state from before the search.
    - Selecting a search result selects the element and keeps the search open.

### R5: Inspector

1. With **one** element selected, it has two sections:
   - **Live** (read from the page): name, tag, id, classes, width × height (px, rounded), position within the page, the first 120 characters of text, text colour, background colour, font family, size and weight. Values update when the element changes.
   - **Details** (from `GET /elements/:key`): component, description, status, owner.
     - An element with no `data-key` shows "No details".
     - A `404` shows "No details for this element". A 404 is not an error.
2. With **several** elements selected, it shows "N elements", and each Live field shows either the value they all share or "Mixed". There is no Details section.
3. When the selection changes while Details are loading, only the latest selection's details are ever shown.

### R6: Failures

1. **Regions.** Each of these is its own region: the board, each preview, the layers panel, each row's child loading, and the inspector's Details section.
2. **A failure in a region shows an error with a Retry button in that region only.** Everything else keeps working.
   - `GET /screens` fails → the board shows the error.
   - A preview's page doesn't load, or its script doesn't respond within 10 seconds → "Couldn't connect to this preview" on that preview only.
   - `GET /elements/:key` fails or returns bad data → error in Details only. Live values still show.
   - A render error in the inspector → the inspector shows the error. The board and the layers panel keep working.
3. **Errors inside a page** are shown as a small "Page error" badge on that preview. Hovering the badge shows the message.
4. **Reporting:**
   - Every failure reaches `report()` **exactly once**, with `{ region, screenId, elementKey? }`.
   - A retry that fails again counts as a new failure.
   - A request that was cancelled or replaced because the user moved on is **not** a failure: no error is shown and nothing is reported.
5. **Where an error happens doesn't matter.** An error thrown while drawing, handling a click or key, handling a message from a preview, in a timer, or when a response arrives gets the same region error and the same single report.
6. **A response or error that arrives after its region is gone** changes nothing and reports nothing.
7. **A dev-only menu** can trigger each of these failures on demand, for the video.

### Out of scope

Editing pages, saving anything across a reload, auth, mobile, and more than one user.

## Deliverables

1. **A public GitHub repo** that runs the backend and your app with one command.
2. **A README** covering:
   - any requirement you found ambiguous or contradictory, and what you decided;
   - how state is organised: what lives where, and who is allowed to change it;
   - how the host and the pages talk to each other: the messages, and what happens when one side is slow, gone, or replaced;
   - **"where this breaks"**: the cases you know your build gets wrong.
3. **A 15-minute video** (Loom or any shareable link) explaining your code. We evaluate your system design calls mainly from this video, so talk through the *why*, not just the *what*.
   - **2 min**: what you built and the main calls you made.
   - **8 min**: walk through the code behind R1–R6, showing each part running. Cover your state model, the host ↔ page protocol, how you identify elements across re-renders and navigation, how the tree loads, and how failures are contained and reported.
   - **3 min**: where it breaks, and what you'd change with another week.
   - **2 min**: how you used AI, and where it got things wrong.

You may study any public product, Figr included. If you do, say what you took and why it works.

## Submitting

Submit your repo, video and resume here: **https://join.figr.design/r/kdqVkj**

---

# Figr Implementation & System Architecture

## 1. Quick Start

Run both the backend (API on `:4000`, Pages on `:4001`) and frontend app (`:5173`) with a single command:

```bash
npm start
```

Or run tests across all suites:

```bash
npm test
```

Build production bundle:

```bash
npm run build
```

---

## 2. System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        HOST APPLICATION (React + Vite)                 │
│                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │      Toolbar (V / I)    │  │        Dev Failure Menu (R6)        │  │
│  └─────────────────────────┘  └─────────────────────────────────────┘  │
│                                                                        │
│  ┌───────────────┐  ┌────────────────────────────────┐  ┌───────────┐  │
│  │ Layers Panel  │  │ Infinite Pan / Zoom Canvas     │  │ Inspector │  │
│  │ (Lazy Loaded) │  │  ┌───────────────────────────┐ │  │ (Live +   │  │
│  │               │  │  │ PreviewCard (1280x800)    │ │  │ Details)  │  │
│  │ - Search      │  │  │  ┌─────────────────────┐  │ │  │           │  │
│  │ - Ancestors   │  │  │  │ PreviewOverlay      │  │ │  │ - Multi-  │  │
│  │ - Keyboard    │  │  │  │ (Scaled 1px/2px)    │  │ │  │   Select  │  │
│  │               │  │  │  └─────────────────────┘  │ │  │ - 404 vs  │  │
│  │               │  │  │  ┌─────────────────────┐  │ │  │   500     │  │
│  │               │  │  │  │ Cross-Origin Iframe │  │ │  │           │  │
│  └───────────────┘  │  │  └─────────────────────┘  │ │  └───────────┘  │
│                     │  └───────────────────────────┘ │                 │
│                     └────────────────────────────────┘                 │
└──────────────────────────────────────┬─────────────────────────────────┘
                                       │ postMessage
                                       │ (figr protocol)
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     PREVIEW IFRAME (:4001)                             │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Page Agent (backend/pages/agent.js)                              │  │
│  │ - Dynamic Session ID (sess_<random>_<timestamp>)                 │  │
│  │ - Capture Phase Interception (click, submit, focus in Select)    │  │
│  │ - Hit-Testing via document.elementsFromPoint                     │  │
│  │ - Element Identity Resolution (key > id > anchor fingerprint)    │  │
│  │ - Wheel Zoom Modifier Detection (Ctrl/Cmd + wheel)               │  │
│  │ - MutationObserver & Scroll/Resize Geometry Dispatcher           │  │
│  │ - Lazy Tree Walk & Full-Tree Search Engine                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Cross-Origin `postMessage` Protocol & Lifecycle

### Protocol Message Envelope
Every message between host and page agent contains:
* `figr: true` — Protocol marker ensuring other messages are ignored.
* `type: string` — Typed command or event identifier.
* `screenId: string` — Identifies which preview card owns this communication.
* `sessionId: string` — Uniquely generated per page agent execution.
* `requestId?: string` — Correlation ID for request-response pairings.
* `version?: number` — Request generation / selection version counter.
* `payload: any` — Typed payload.

### Session Lifecycle & Origin Security
1. **Dynamic Session ID**: Each time an iframe loads or navigates, `agent.js` initializes with a brand-new `sessionId = 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now()`.
2. **Handshake**: The page agent posts `READY` upon startup. The host responds with `INIT` containing `screenId`, current `mode`, and existing selections. The agent locks onto `hostOrigin` from `event.origin` and drops messages from untrusted origins.
3. **Session Invalidation**: When an iframe navigates (`NAVIGATION_START`, `pagehide`, or reload), the host immediately invalidates `currentSessionId`, resets that preview's selection and layers, and starts the 10-second connection timer. Any in-flight response from the older session is silently ignored.

---

## 4. Element Identity Strategy

The assignment specifies:
> A selected element that survives a DOM rebuild must remain selected.

### Preferred Strategy Order
1. **`data-key`**: If present, formatted as `key:<dataKey>`. Completely stable across any restructuring.
2. **Stable `id`**: If present and not a generic framework root (`root`, `app`), formatted as `id:<id>`.
3. **Anchor + Semantic/Path Fingerprint**:
   `[Nearest Ancestor Anchor (id or key or body)] > [tag][.firstClass][name="..."][text="..."]#[relativeOrdinal]`
   - Extracts the direct text snippet (normalized and trimmed to 40 characters) without text from deeper grandchildren.
   - Computes the relative ordinal among identical signature peers under the anchor.

### Survival Capabilities
- **DOM Node Replacement**: If `innerHTML` is rewritten (as in `page-4.html`), the identity string resolves to the reconstructed element matching the anchor, tag, and text signature.
- **Sibling Insertion Before Element**: If a new item is unshifted to the top of a list, the text signature matches the original element rather than jumping to the new item.
- **Refusing to Select the Wrong Element**: When an element is deleted, the resolver returns `null`. The host marks the item as missing and displays `"This element no longer exists"` rather than guessing or jumping.

---

## 5. State Ownership & Architecture Boundaries

| Domain | Store / Module | State Owned | Who Mutates It |
|---|---|---|---|
| **Board Viewport** | `boardStore` | `panX`, `panY`, `scale`, `mode` (`select` \| `interact`), `activeScreenId` | User toolbar, board drag/wheel, preview activation |
| **Selection & Geometry** | `selectionStore` | `selectedItems`, `hoveredItem`, `geometryCache`, `selectionVersion`, `isMissingSelected` | Click events from preview, keyboard shortcuts, scroll/mutation geometry updates |
| **Layers Tree** | `layersStore` | `screens[screenId]` (`nodes`, `rootIds`, `expandedIds`, `loadingIds`, `failedIds`, `scrollPos`, versions) | `GET_ROOT`, `CHILDREN` responses, panel expansion, search filter |
| **Inspector** | `inspectorStore` | `liveInfo`, `multiLive`, `multiCount`, `details`, `detailsError`, `details404`, `activeVersion` | `LIVE_INFO` messages, `GET /elements/:key` API calls |
| **Failures & Errors** | `errorStore` & `errorService` | Region errors (`board`, `preview`, `layers`, `layers-row`, `details`, `inspector`), synthetic failure flags | Catch handlers, connection timeouts, dev failure triggers |

---

## 6. Failure Isolation & Exactly-Once Reporting

### 6 Isolated Regions
1. **`board`**: Screens API failure displays a full-board recovery banner.
2. **`preview`**: If a preview does not answer `READY` within 10 seconds, only that preview card renders the `"Couldn't connect to this preview"` overlay with a Retry button.
3. **`layers`**: Fatal layer errors isolate to the layers sidebar.
4. **`layers-row`**: If loading children for a row times out (3 seconds), only that row shows `"Couldn't load"` and a Retry button.
5. **`details`**: If `GET /elements/:key` fails with 5xx or malformed JSON, only the Details section shows an error. The Live section continues displaying styles and bounds.
6. **`inspector`**: Inspector render exceptions are caught by a dedicated ErrorBoundary without affecting the board or layers panel.

### Centralized `report()` Deduplication
All errors flow through `handleFailure()` in `errorStore.ts` to `reportRegionFailure()` in `errorService.ts`:
- Failure tokens (`region::screenId::elementKey::failureToken`) track active failure lifecycles in a `Set`.
- The first failure invokes `report(error, context)` **exactly once**.
- Subsequent re-renders or repeated events with the same failure token are dropped.
- Clicking **Retry** clears the token via `retryRegion()`. If the retry fails again, a new failure is registered and reported again.
- Aborted or cancelled requests (`AbortError`, stale versions) are discarded and never reported.

---

## 7. Requirement Checklist (R1.1 – R6.7)

| Req ID | Requirement Summary | Status | Notes & Verification |
|---|---|---|---|
| **R1.1** | 24 previews from `GET /screens` in grid, 1280x800 each with name | **Implemented & Tested** | Verified grid layout and screen names. |
| **R1.2** | Dragging & wheel on empty board space pans board | **Implemented & Tested** | Panning with mouse drag and wheel. |
| **R1.3** | Ctrl/Cmd + wheel zooms 25%–400% centered on pointer, including over iframes | **Implemented & Tested** | Modifier wheel intercepted in agent capture phase and converted to pointer-centered zoom in host. |
| **R1.4** | Normal wheel over preview scrolls page in both modes | **Implemented & Tested** | Passive native wheel scrolling preserved. |
| **R1.5** | Select (V) & Interact (I) modes; Select blocks click/submit/nav; Interact enables native behavior | **Implemented & Tested** | Capture phase interception with `stopImmediatePropagation()` in Select mode. |
| **R2.1** | 1px hover outline with element name label | **Implemented & Tested** | Rendered in `PreviewOverlay` with zoom-compensated 1px border. |
| **R2.2** | Exactly one hovered element board-wide | **Implemented & Tested** | Stored globally in `selectionStore.hoveredItem`. |
| **R2.3** | Hover clears on leave or pan/zoom start | **Implemented & Tested** | Cleared on `pointerleave`, `mouseleave`, and pan/zoom handlers. |
| **R2.4** | Inspects disabled elements, SVG, images, and elements under sticky headers | **Implemented & Tested** | Resolved via `document.elementsFromPoint`. |
| **R2.5** | Page background (`html`, `body`) never hovered | **Implemented & Tested** | Excluded in `isInspectableElement`. |
| **R3.1** | 2px selection outline in distinct color + name label | **Implemented & Tested** | Rendered with `var(--selection-outline)` at constant screen thickness. |
| **R3.2** | Shift+click toggles in same preview; replaces in different preview | **Implemented & Tested** | Verified in `selection.test.ts`. |
| **R3.3** | Escape, clicking page background, or clicking empty board clears selection | **Implemented & Tested** | Selection cleared; activeScreenId preserved. |
| **R3.4** | Outlines stay glued across pan, zoom, scrolls, resizes, mutations; flip below when no room | **Implemented & Tested** | Geometry synced via ResizeObserver, MutationObserver, scroll listeners. |
| **R3.5** | Keyboard nav on most recent selection: Enter (child), Shift+Enter (parent), Tab/Shift+Tab (wrapping siblings) | **Implemented & Tested** | Implemented via tree traversal in `agent.js` and keyboard shortcuts. |
| **R3.6** | Shortcuts work after clicking inside preview | **Implemented & Tested** | Keydown events captured in agent and forwarded to host. |
| **R3.7** | Survives DOM rebuilds & sibling insertion; deletion marks missing; never jumps | **Implemented & Tested** | Verified in `elementIdentity.test.ts` (page-4 scenarios). |
| **R3.8** | Navigation clears preview selection, resets layers, awaits new session | **Implemented & Tested** | Verified for normal `<a href>` links (`page-6.html` → `page-6-next.html`), `history.pushState`, `history.replaceState`, `popstate`, `hashchange`, and bfcache `pageshow`. Session invalidates immediately on navigation start; late messages discarded. |
| **R4.1** | Layers shows active preview DOM tree; empty message when none | **Implemented & Tested** | Only displays tree for `activeScreenId`. |
| **R4.2** | Row indentation, name, chevron for children; top-level are body children | **Implemented & Tested** | Clean tree representation in `LayerRow`. |
| **R4.3** | Lazy loading on expand with 3s timeout -> "Couldn't load" with retry | **Implemented & Tested** | 3s timer with versioning and row retry. |
| **R4.4** | Bidirectional hover sync | **Implemented & Tested** | Preview hover highlights nearest visible row; row hover highlights preview. |
| **R4.5** | Bidirectional selection sync (preview click expands ancestors and scrolls panel to row) | **Implemented & Tested** | Auto-ancestor expansion on selection. |
| **R4.6** | Row click scrolls only that page to element | **Implemented & Tested** | `SCROLL_TO` smooth scroll in iframe without moving host board. |
| **R4.7** | Multi-select via Shift+click on rows | **Implemented & Tested** | Multi-row selection highlight and multi-item sync. |
| **R4.8** | Layers panel keyboard nav (Arrows) | **Implemented & Tested** | Up/down visible navigation, left/right collapse/expand. |
| **R4.9** | Expansion state and panel scroll position remembered per preview | **Implemented & Tested** | Preserved in `layersStore.screens[screenId]`. |
| **R4.10** | DOM mutations update tree and preserve expanded/selection states | **Implemented & Tested** | MutationObserver subtree sync. |
| **R4.11** | Full-tree search restores exact normal expansion on clear | **Implemented & Tested** | Verified with unloaded nodes; ancestors materialized; exact expansion state restored on clear. |
| **R5.1** | Single select: Live section + Details section (`GET /elements/:key`, 404 valid) | **Implemented & Tested** | Live properties displayed; 404 handled gracefully. |
| **R5.2** | Multi-select: "N elements" and shared vs "Mixed", no Details | **Implemented & Tested** | Verified in `raceConditions.test.ts`. |
| **R5.3** | Selection versioning discards stale Details and Live responses | **Implemented & Tested** | Verified in `raceConditions.test.ts`. |
| **R6.1** | 6 isolated regions | **Implemented & Tested** | Region isolation verified. |
| **R6.2** | Region failure shows error with Retry button in that region only | **Implemented & Tested** | Retry buttons in board, preview, layer rows, details, inspector. |
| **R6.3** | "Page error" badge on preview with tooltip for iframe errors | **Implemented & Tested** | Captured via `window.onerror` and `unhandledrejection`. |
| **R6.4** | Exactly-once reporting to `report(error, context)`; retries report anew | **Implemented & Tested** | Verified in `errorService.test.ts`. |
| **R6.5** | Errors in timers, events, postMessage, render caught and reported | **Implemented & Tested** | Unified error handling in `errorStore.ts`. |
| **R6.6** | Responses/errors for obsolete sessions/regions discarded | **Implemented & Tested** | Session ID and version check guards. |
| **R6.7** | Dev Failure Menu in toolbar to simulate all failures on demand | **Implemented & Tested** | Functional dropdown menu with toggleable failure scenarios. |

---

## 8. Where This Breaks (Known Limitations & Edge Cases)

### 1. Completely Identical Unkeyed Sibling Nodes
* **Exact scenario**: A dynamic list containing multiple unkeyed siblings that share identical tags, identical CSS classes, identical attributes, and identical (or empty) text content (e.g., 5 identical skeleton placeholders `<div class="skeleton-card"></div>` under a feed container). An element is selected, and then new identical items are prepended/removed while rebuilding the container DOM.
* **Current behavior**: The identity resolver relies on the relative ordinal index under the nearest anchor. When identical siblings change position, if the count or relative position shifts, the resolver returns `null` (marking the element as missing) rather than jumping to an unintended node.
* **Why it happens**: Without `data-key`, unique IDs, distinct text snippets, or distinctive attributes, the DOM contains no semantic information to distinguish identical sibling nodes after a complete teardown and reconstruction.
* **Proposed fix**: In user code, adopt `data-key` or stable IDs on list items. In the inspection agent, if write permission is permitted, attach an ephemeral non-enumerable tracking symbol or session attribute (`data-figr-track`) to DOM nodes upon initial selection.

### 2. Cross-Origin Framing Restrictions (Strict CSP / X-Frame-Options)
* **Exact scenario**: Pointing a preview card to an external URL that serves `Content-Security-Policy: frame-ancestors 'none'` or `X-Frame-Options: DENY`.
* **Current behavior**: The browser refuses to frame the document in an `<iframe>`. The page agent cannot execute, and after 10 seconds the preview enters the `"Couldn't connect to this preview"` error region with a Retry button.
* **Why it happens**: Browser-enforced security policies explicitly forbid third-party iframe embedding when frame protection headers are present.
* **Proposed fix**: Route external URLs through a local development proxy that strips framing restrictions and injects the `agent.js` script tag, or use a companion browser extension.

### 3. Encapsulated Elements Inside Closed Shadow DOM
* **Exact scenario**: A preview page utilizing Web Components where elements are inside a Shadow Root created with `attachShadow({ mode: 'closed' })`.
* **Current behavior**: The host inspector can select and measure the custom element host itself, but cannot reach inside to select individual internal shadow DOM elements.
* **Why it happens**: The browser's `closed` shadow DOM standard deliberately prevents external scripts (including `document.elementsFromPoint` and `querySelector`) from traversing or querying the shadow root.
* **Proposed fix**: Use `mode: 'open'` for custom components in dev environments, or monkey-patch `Element.prototype.attachShadow` in `agent.js` prior to component initialization to retain a weak reference to all shadow roots.

---

## 9. AI Usage & Decisions

- **Architectural Clarifications & Decisions**:
  - *Active Preview Definition*: Hovering alone never changes `activeScreenId`. Clicking an element in a preview activates that preview, which immediately shifts the Layers panel and Inspector to that preview. Clicking empty board clears the selection but does not clear `activeScreenId`, allowing the user to continue browsing the active preview's layer tree.
  - *Constant-Size Overlays*: Rather than drawing outlines inside the iframe (which would interfere with iframe styles and layout), the host draws all outlines in `PreviewOverlay`. Border widths (`Math.max(1, 2 / scale)`) and label scales (`1 / scale`) compensate for board zoom, ensuring crisp 1px/2px outlines and readable labels at any magnification.
- **Where AI Had to Be Corrected**:
  - *Anchored Identity Parsing*: Early agent regex treated any locator starting with `id:` or `key:` as a direct lookup, breaking anchored paths such as `id:feed > li[text="..."]`. This was caught during unit testing and fixed with `&& !raw.includes(' > ')`.
  - *React Render Depth in Layers & Inspector*: The initial implementation caused re-renders in `LayersPanel` and `InspectorPanel` due to unmemoized array filters in hook dependencies. These were restructured using fine-grained Zustand selectors, `useMemo`, and event-driven scroll handlers.
  - *Unloaded Node Search Materialization*: Initial search design only returned matching element IDs, which could not render in the host if intermediate ancestors were collapsed and unloaded. Corrected by having `searchEntireTree` materialize all ancestor `TreeNode` hierarchies so deep search results render properly even from a fully collapsed tree.


