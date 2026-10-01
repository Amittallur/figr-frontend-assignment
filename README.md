# Figr — Frontend Engineer Assignment

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

## 3. Core Evaluation Deliverables

The Figr assignment brief requires explicit coverage of four core architectural questions:
1. [Ambiguous or Contradictory Requirements & What We Decided](#31-ambiguous-or-contradictory-requirements--what-we-decided)
2. [State Organization: What Lives Where, and Who is Allowed to Change It](#32-state-organization-what-lives-where-and-who-is-allowed-to-change-it)
3. [Host ↔ Page Communication Protocol: Messages, and What Happens When Slow, Gone, or Replaced](#33-host--page-communication-protocol-messages-and-what-happens-when-slow-gone-or-replaced)
4. ["Where This Breaks": The Cases Our Build Gets Wrong](#34-where-this-breaks-the-cases-our-build-gets-wrong)

---

### 3.1 Ambiguous or Contradictory Requirements & What We Decided

#### 1. Unkeyed Elements vs. 404 Metadata (R5.1)
* **The Ambiguity**: Requirement R5.1 states:
  > *"An element with no data-key shows 'No details'. A 404 shows 'No details for this element'. A 404 is not an error."*
  Does every selected element trigger a `GET /elements/:key` network call?
* **Our Decision**:
  - Standard HTML elements without a `data-key` (e.g. `<p>`, generic `<div>` wrappers, headings) bypass the backend API entirely and immediately display **`"No details"`**. This prevents thousands of useless 404 network requests.
  - Only elements with a `data-key` attribute invoke `GET /elements/:key`. If the backend returns `404 Not Found` (meaning the key has no entry in `elements.json`), it cleanly renders **`"No details for this element"`** without registering a failure or reporting to `report()`.

#### 2. Multi-Page (MPA) vs. Client-Side (SPA) Navigation (R3.8)
* **The Ambiguity**: Requirement R3.8 specifies:
  > *"A page navigates (a link followed in Interact mode): that preview's selection clears, Select mode works on the new page with no reload of the board, and the layers panel shows the new page."*
  The kit provides static HTML files (`page-6.html` linking to `page-6-next.html`), but modern web apps frequently use client-side SPA routing (`history.pushState`, `history.replaceState`, `popstate`, `hashchange`).
* **Our Decision**:
  - We implemented comprehensive support for **both MPA and SPA navigations**.
  - In `agent.js`, we hook traditional navigation (`beforeunload`, `pagehide`, `pageshow`) as well as wrapping `history.pushState`, `history.replaceState`, and listening to `popstate` and `hashchange`.
  - In both scenarios, the agent notifies the host with `NAVIGATION_START`, invalidates the current session ID, resets the preview's selection and layers tree, and initiates a clean session handshake on the new page.

#### 3. Active Preview Definition vs. Hovering
* **The Ambiguity**: The brief defines an active preview as *"the preview the user last clicked in Select mode."* What should happen when hovering an element on a preview that is not currently active?
* **Our Decision**:
  - Hovering is strictly board-wide and ephemeral. Hovering an element in Preview B while Preview A is active draws the hover outline on Preview B, but does **not** change `activeScreenId`.
  - The Layers Panel and Inspector remain focused on the active preview until the user explicitly clicks Preview B in Select mode.
  - Clicking empty board space clears the selection, but preserves `activeScreenId` so the user does not lose their place in the Layers tree.

#### 4. Zoom-Independent Outlines & Labels (R3.4)
* **The Ambiguity**: Outlines must stay 1px (hover) and 2px (selection) and labels must keep the same size at all board zoom levels (25% to 400%).
* **Our Decision**:
  - Rather than rendering outlines inside the iframe (which would break if the page has `overflow: hidden`, transforms, or strict CSS), the host renders all outlines in `PreviewOverlay` on top of each iframe.
  - We apply zoom-inverse scaling: `borderWidth = Math.max(1, 2 / scale)` and label `transform = scale(${1 / scale})`. This guarantees crisp, constant screen-pixel borders and legible typography from 25% to 400% zoom.

---

### 3.2 State Organization: What Lives Where, and Who is Allowed to Change It

To prevent state synchronization bugs and race conditions, the application follows strict unidirectional state ownership:

| Domain | Store / Module | State Owned | Who Mutates It |
|---|---|---|---|
| **Board Viewport** | `boardStore` | `panX`, `panY`, `scale`, `mode` (`select` \| `interact`), `activeScreenId` | Toolbar controls, mouse drag/wheel on board, preview click activation |
| **Selection & Geometry** | `selectionStore` | `selectedItems`, `hoveredItem`, `geometryCache`, `selectionVersion`, `isMissingSelected` | Click events from preview, keyboard shortcuts, scroll/mutation geometry updates from agent |
| **Layers Tree** | `layersStore` | `screens[screenId]` (`nodes`, `rootIds`, `expandedIds`, `loadingIds`, `failedIds`, `scrollPos`, versions) | `GET_ROOT` and `GET_CHILDREN` responses, panel expansion/collapse, search filtering |
| **Inspector** | `inspectorStore` | `liveInfo`, `multiLive`, `multiCount`, `details`, `detailsError`, `details404`, `activeVersion` | `LIVE_INFO` messages from agent, `GET /elements/:key` API calls |
| **Failures & Errors** | `errorStore` & `errorService` | Region errors (`board`, `preview`, `layers`, `layers-row`, `details`, `inspector`), synthetic failure flags | Catch handlers, connection timeouts, dev failure triggers |

#### State Mutation Rules
1. **The Page Agent Never Mutates Host State Directly**: The agent is purely an observer and actuator. It measures DOM elements and dispatches typed `postMessage` events. Only host store actions commit state changes.
2. **Components Never Mutate Stores Directly**: React components consume state via fine-grained Zustand selectors and trigger mutations exclusively through store action methods.
3. **Session Guards on Every Store Action**: Any incoming message carrying an outdated `sessionId` or mismatched `selectionVersion` is rejected before touching the stores.

---

### 3.3 Host ↔ Page Communication Protocol: Messages, and What Happens When Slow, Gone, or Replaced

All cross-origin communication between the host (`http://localhost:5173`) and preview pages (`http://localhost:4001`) occurs over `window.postMessage`.

#### Protocol Message Envelope
```typescript
interface FigrMessage<T = any> {
  figr: true;              // Protocol marker to filter out third-party messages
  type: string;            // Message identifier (e.g. 'READY', 'SELECT', 'GET_ROOT')
  screenId: string;        // ID of the target/source preview card
  sessionId: string;       // Unique ID per iframe execution: sess_<random>_<timestamp>
  requestId?: string;      // Correlation ID for request-response pairs
  version?: number;        // Selection or request version counter
  payload: T;              // Strongly-typed payload
}
```

#### Core Protocol Message Dictionary
* `READY`: Page agent notifies host that it has initialized and is listening.
* `INIT`: Host sends `screenId`, current `mode`, and existing selections to the agent.
* `HOVER`: Agent notifies host of element hover geometry, or null when cleared.
* `SELECT`: Agent notifies host of user click with element geometry and selector.
* `SET_MODE`: Host instructs agent to switch between `select` and `interact`.
* `GET_ROOT` / `ROOT_DATA`: Host requests the body's top-level child nodes.
* `GET_CHILDREN` / `CHILDREN`: Host lazily requests children for an expanded tree row.
* `SCROLL_TO`: Host instructs agent to smoothly scroll a specific element into view.
* `SYNC_GEOMETRY`: Agent pushes updated coordinates on scroll, resize, or DOM mutation.
* `ELEMENT_MISSING`: Agent informs host that a selected element was removed from the DOM.
* `PAGE_ERROR`: Agent captures runtime iframe JS errors and forwards them to host.
* `NAVIGATION_START`: Agent informs host of an impending navigation or page unload.

---

#### What Happens When One Side is Slow, Gone, or Replaced?

#### 1. When One Side is SLOW
* **Slow Preview Page Connection**:
  - When a preview iframe mounts or navigates, the host starts a **10-second connection timer**.
  - If the page agent does not respond with `READY` within 10 seconds (e.g., hanging server or network timeout), the host marks that preview as failed.
  - An isolated `"Couldn't connect to this preview"` overlay with a **Retry** button renders over that preview card only. The rest of the board remains fully operational.
  - The failure is logged to `report()` **exactly once**.
* **Slow Layer Node Expansion (3-second limit)**:
  - When expanding a row in the Layers panel, the host starts a **3-second request timer**.
  - While waiting, the row displays a loading spinner.
  - If the agent fails to answer within 3 seconds, the row transitions to `"Couldn't load"` with an inline **Retry** button on that row only.
  - Rapid collapsing and re-expanding cancels prior timers and increments the row request version, preventing missing or duplicate children.
* **Slow Details API (`GET /elements/:key`)**:
  - The Details section uses `AbortController`.
  - If the user selects another element before the previous details request finishes, the in-flight request is aborted immediately. Stale responses are discarded via `selectionVersion` checks.

#### 2. When One Side is GONE
* **Iframe Navigates or Crashes**:
  - On `beforeunload` or `pagehide`, the agent dispatches `NAVIGATION_START`.
  - The host immediately invalidates `currentSessionId` by setting it to `null`.
  - Any subsequent message carrying the dead `sessionId` is silently dropped.
  - The preview's selection and layers tree are cleared, and the 10-second connection timer starts anew.
* **Selected Element is Deleted From the DOM**:
  - The agent's `MutationObserver` checks whether selected elements still exist.
  - If an element is removed, the resolver returns `null` and dispatches `ELEMENT_MISSING`.
  - The host marks the item as missing and updates the Inspector to display **`"This element no longer exists"`** until a new selection is made.
* **Host Unmounts or Reloads**:
  - The page agent's listeners are passive and wrapped in try-catch guards. If the parent window is closed or unresponsive, postMessage safely fails without crashing the iframe.

#### 3. When One Side is REPLACED
* **Iframe Navigates to a New Page (e.g. `page-6.html` → `page-6-next.html`)**:
  - When the new document loads, `agent.js` generates a brand-new `sessionId` (`sess_<random>_<timestamp>`).
  - The agent sends `READY` with the new session ID.
  - The host establishes a new handshake, fetches the new document's root layer nodes, and ensures zero state pollution from the old page.
* **DOM Rebuild (`innerHTML` replacement)**:
  - When a page replaces DOM nodes dynamically (as in `page-4.html`'s dynamic activity feed), the agent uses its **multi-tier identity strategy** to match the reconstructed element by anchor, tag, and text content rather than relying on stale DOM object references.

---

### 3.4 "Where This Breaks": The Cases Our Build Gets Wrong

In accordance with the assignment requirements, here are the edge cases where our implementation reaches its boundaries:

#### 1. Completely Identical Unkeyed Dynamic Sibling Nodes
* **Exact Scenario**: A dynamic list contains multiple unkeyed siblings that share identical tags, identical CSS classes, identical attributes, and identical (or empty) text content (e.g., five identical skeleton placeholders `<div class="skeleton-card"></div>` inside a feed). An element is selected, and new identical placeholders are dynamically prepended or removed during a DOM rebuild.
* **Current Behavior**: The identity resolver relies on the relative ordinal index under the nearest anchor. When identical siblings change position, if the count or relative position shifts, the resolver returns `null` (marking the element as missing) rather than risking jumping to the wrong node.
* **Why it Happens**: Without `data-key`, unique IDs, or distinct text content, the DOM contains no semantic information to distinguish identical sibling nodes after a complete teardown and reconstruction.
* **Proposed Fix**: In user code, adopt `data-key` or unique IDs on list items. In the inspection agent, if write permission is permitted, attach an ephemeral non-enumerable tracking symbol or session attribute (`data-figr-track`) to DOM nodes upon initial selection.

#### 2. Cross-Origin Framing Restrictions (Strict CSP / X-Frame-Options)
* **Exact Scenario**: Pointing a preview card to an external URL that serves `Content-Security-Policy: frame-ancestors 'none'` or `X-Frame-Options: DENY`.
* **Current Behavior**: The browser refuses to frame the document in an `<iframe>`. The page agent cannot execute, and after 10 seconds the preview enters the `"Couldn't connect to this preview"` error region with a Retry button.
* **Why it Happens**: Browser-enforced security policies explicitly forbid third-party iframe embedding when frame protection headers are present.
* **Proposed Fix**: Route external URLs through a local development proxy that strips framing restrictions and injects the `agent.js` script tag, or use a companion browser extension.

#### 3. Encapsulated Elements Inside Closed Shadow DOM
* **Exact Scenario**: A preview page utilizing Web Components where elements are inside a Shadow Root created with `attachShadow({ mode: 'closed' })`.
* **Current Behavior**: The host inspector can select and measure the custom element host itself, but cannot reach inside to select individual internal shadow DOM elements.
* **Why it Happens**: The browser's `closed` shadow DOM standard deliberately prevents external scripts (including `document.elementsFromPoint` and `querySelector`) from traversing or querying the shadow root.
* **Proposed Fix**: Use `mode: 'open'` for custom components in dev environments, or monkey-patch `Element.prototype.attachShadow` in `agent.js` prior to component initialization to retain a weak reference to all shadow roots.

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

## 5. Failure Isolation & Exactly-Once Reporting

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

## 6. Requirement Verification Matrix (R1.1 – R6.7)

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
| **R5.1** | Single select: Live section + Details section (`GET /elements/:key`, 404 valid) | **Implemented & Tested** | Live properties computed from DOM; keyed elements fetch component details; unkeyed elements display "No details"; 404s display "No details for this element" without error. |
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

## 7. AI Collaboration & Corrections

- **Where AI Accelerated Development**: Rapid scaffolding of TypeScript interfaces, Zustand slice templates, and comprehensive Vitest test suites.
- **Where AI Had to Be Corrected**:
  - *Anchored Identity Parsing*: Early AI regex treated any locator starting with `id:` or `key:` as a direct lookup, breaking anchored paths such as `id:feed > li[text="..."]`. This was caught during unit testing and corrected with `&& !raw.includes(' > ')`.
  - *React Render Depth in Layers & Inspector*: Early AI code caused unnecessary re-renders in `LayersPanel` and `InspectorPanel` due to unmemoized array filters in hook dependencies. These were restructured using fine-grained Zustand selectors, `useMemo`, and event-driven scroll handlers.
  - *Unloaded Node Search Materialization*: Initial search design only returned matching element IDs, which could not render in the host if intermediate ancestors were collapsed and unloaded. Corrected by having `searchEntireTree` materialize all ancestor `TreeNode` hierarchies so deep search results render properly even from a fully collapsed tree.

---

## 8. Video Presentation & Walkthrough Guide (15-Minute Rubric Breakdown)

Use this structured script when recording your 15-minute or concise video submission:

### Part 1: Architecture Overview & Main Decisions (2 min)
- **High-Level Design**: Explain that the host (`:5173`) coordinates 24 cross-origin iframes (`:4001`) via a typed `postMessage` protocol and an injected in-page inspection agent (`agent.js`).
- **Isolation & Security**: Point out that the host never assumes synchronous access to iframe DOMs. All communication uses unique session IDs (`sessionId`), preventing race conditions and stale frames during page reloads or navigation.
- **State Partitioning**: Briefly show the 5 dedicated Zustand stores (`boardStore`, `selectionStore`, `layersStore`, `inspectorStore`, `errorStore`), ensuring modularity and isolated rendering.

### Part 2: Feature Walkthrough Across Requirements R1–R6 (8 min)
1. **R1: Board & Navigation**:
   - Pan across the 24 preview cards.
   - Demonstrate pointer-centered zooming (`Ctrl/Cmd + wheel`, or zoom buttons `+`/`-`).
   - Toggle between **Select mode (`V`)** and **Interact mode (`I`)**.
2. **R2 & R3: Inspection & Resilient Selection**:
   - Hover over elements to show the 1px purple hover outline and name pills.
   - Click the **"Get started"** button on Screen 7 to show the 2px blue selection outline.
   - Demonstrate **Multi-Selection** by holding `Shift` and selecting multiple elements.
   - Demonstrate **Keyboard Navigation**: `Enter` (first child), `Shift+Enter` (parent), and `Tab` / `Shift+Tab` (cycling siblings).
   - Demonstrate **DOM Rebuild Survival**: Show that selecting an item on Screen 4 remains selected even after dynamic feed updates.
   - Demonstrate **Page Navigation**: Switch to Interact mode on Screen 6, click `"Next: Configuration →"`, and show that the layers panel and inspector update seamlessly for the new page.
3. **R4: Bidirectional Layers Tree**:
   - Show lazy loading with chevrons and loading spinners.
   - Hover a row in the Layers panel to highlight the element on the canvas; hover an element on canvas to highlight the tree row.
   - Type in the search box to filter the tree across all nodes, and clear the search to prove that the exact previous expansion state is restored.
4. **R5: Inspector Panel (Live vs. Details)**:
   - Select the `"Get started"` button (`data-key="cta-primary"`): show live computed box model styles alongside metadata fetched from `GET /elements/cta-primary` (`Button`, `stable`, `Growth`).
   - Select an unkeyed element (e.g. `<p>`): show that it displays `"No details"`.
   - Multi-select multiple items: show that the inspector cleanly shifts to the multi-select summary.
5. **R6: Fault Tolerance & Dev Failure Menu**:
   - Open the **Dev Failure Menu** in the toolbar.
   - Simulate a `500 Server Error` on Details API: demonstrate that only the Details section shows an error box with a **Retry** button while live properties continue working.
   - Show that errors inside iframes generate a subtle "Page error" badge without crashing the host app.

### Part 3: Where This Breaks & What to Change With Another Week (3 min)
- **Identical Unkeyed Dynamic Siblings**: Explain the limitation where identical unkeyed siblings change position without semantic IDs or text differences. Explain how introducing `data-figr-track` or persistent DOM symbols solves it.
- **Closed Shadow DOM & Cross-Origin CSP**: Discuss browser boundaries around `closed` shadow roots and `frame-ancestors: 'none'`, and how a local dev proxy or browser extension would address production constraints.
- **Future Improvements**: Virtualized canvas rendering for hundreds of previews, side-by-side responsive viewport testing, and CSS diff inspection.

### Part 4: AI Collaboration & Reflection (2 min)
- **Where AI accelerated development**: Fast generation of test harnesses, TypeScript interface definitions, and state stores.
- **Where AI required engineering correction**: Anchored path resolution in agent identity locators, tree search materialization, and React render depth optimization.



