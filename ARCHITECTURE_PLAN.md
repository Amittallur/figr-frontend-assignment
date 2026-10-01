# Figr Frontend Inspector Architecture Plan (Refined)

## 1. Cross-Origin Messaging Protocol
- **Transport**: `window.postMessage` between Host (`http://localhost:5173` or any host origin) and Previews (`http://localhost:4001`).
- **Dynamic Origin Validation**:
  - Page agent validates `event.source === window.parent`. On `INIT`, page agent saves `hostOrigin = event.origin` and verifies all subsequent messages match `hostOrigin`.
  - Host validates `event.origin === 'http://localhost:4001'` (or preview URL origin) and verifies `event.source === iframe.contentWindow`.
- **Message Envelope**:
  ```ts
  interface FigrMessage<T = any> {
    figr: true;
    type: string;
    screenId: string;
    sessionId: string; // fresh per page load
    requestId?: string; // per request correlation
    version?: number; // request/selection generation
    payload?: T;
  }
  ```
- **Session Lifecycle & Stale Message Invalidation**:
  - Page agent generates `sessionId = 'sess_' + Math.random().toString(36).slice(2) + '_' + Date.now()` on script evaluation.
  - When an iframe navigates or reloads, the old `sessionId` is immediately obsolete.
  - The Host maintains `activeSessions: Map<screenId, sessionId>`. Any message arriving with a non-matching `sessionId` is dropped immediately before any state update or error report.

## 2. Element Identity Strategy (Multi-Strategy with Confidence & No Guessing)
- **Design Philosophy**: A selected element must survive DOM rebuilds (e.g. `page-4.html` rebuilding `feed.innerHTML` every 2s, prepending items). If identity cannot be established with high confidence, refuse to resolve (mark element as missing) rather than guessing or jumping selection to an unrelated sibling.
- **Hierarchy of Locators**:
  1. **Primary Anchor**:
     - `key:<data-key>` if `data-key` attribute is present.
     - `id:<id>` if `id` is present and valid (not generic container).
  2. **Scoped Semantic Fingerprint**:
     - Locate nearest anchored ancestor (`key`, `id`, or `body`).
     - Build descriptor:
       - Tag name (e.g. `li`, `button`)
       - First class name
       - `data-name` if present
       - Content signature: normalized text snippet (first 40 characters of textual content).
       - Characteristic attributes: `type`, `name`, `href`, `placeholder`.
       - Relative ordinal among identical signature peers under that anchor.
  3. **Resolution & Confidence Gate**:
     - Resolve via primary anchor if present.
     - Under parent anchor, query matching elements.
     - Match against tag, `data-name`, and content signature.
     - If candidate count > 1 and signatures are identical with no stable ordinal, return `null`.
     - If no candidate found (e.g. item dropped off in `page-4.html`), return `null`.
     - Result: returns the exact surviving DOM element or `null` (missing). **Never guesses or jumps.**

## 3. Selection State Model (Identity-First, Not Geometry)
- **State Store**:
  ```ts
  interface SelectionItem {
    screenId: string;
    elementId: string; // stable identity string
    identity: ElementIdentity; // structured locator
    name: string;
    dataKey?: string;
    selectedAt: number;
    isMissing?: boolean;
  }

  interface SelectionState {
    activeScreenId: string | null;
    selectedItems: SelectionItem[];
    geometryCache: Record<string, ElementRect>; // transient viewport rects
    selectionVersion: number;
  }
  ```
- **Rules**:
  - Single click: replaces `selectedItems` with clicked element; sets `activeScreenId = screenId`.
  - Shift + click:
    - Same preview: toggles element in `selectedItems`.
    - Different preview: replaces selection with target element on new screen, updates `activeScreenId`.
  - Escape / click background (`html`/`body`) / click empty board: clears selection. `activeScreenId` remains unchanged when clearing selection.
  - Active Preview: Only changes on click in Select mode. Hovering does NOT make preview active.
  - If DOM mutation causes all selected elements to be missing: Inspector displays *"This element no longer exists"* until next selection.

## 4. Geometry Architecture & Host Overlays
- **Coordinate Transformation Pipeline**:
  ```
  Element DOMRect (in iframe viewport: x, y, width, height)
          ↓ (clipped to iframe 1280 × 800)
  Preview Container Coordinates (preview.left, preview.top)
          ↓
  Board Canvas Coordinates (canvasX = panX + scale * previewX, canvasY = panY + scale * previewY)
  ```
- **Overlay Rendering**:
  - Host renders a dedicated overlay layer per preview on top of the iframe.
  - Hover: 1px outline + name label.
  - Selection: 2px outline in distinct color + name label.
  - Visual thickness: Scaled so visual thickness remains exactly 1px / 2px regardless of board zoom (25% to 400%).
  - Labels: Constant screen typography (11px font) via inverse scale transform.
  - Boundary clipping: Outlines clipped to preview frame (`1280 × 800`). If element is scrolled out of view, outline hides visually but remains logically selected.
  - Flip label: If element top is < 24px from preview top, label renders below the element.
- **Geometry Refresh Triggers**:
  - `scroll` in iframe (window or nested `.scroll-area` in `page-3.html`).
  - `ResizeObserver` on element / viewport.
  - `MutationObserver` on DOM changes.
  - Board pan & zoom.
  - Throttled with `requestAnimationFrame`.

## 5. Zoom Over Iframe (`Ctrl/Cmd + wheel`)
- **Event Interception**:
  - Iframe page agent listens for `wheel` with `capture: true, passive: false`.
  - If `e.ctrlKey || e.metaKey`:
    - `e.preventDefault()`, `e.stopPropagation()`.
    - Dispatches `BOARD_ZOOM` to host with `{ deltaY, clientX, clientY }`.
    - Host converts iframe coords to window coords and zooms board centered on pointer!
  - If no modifier key: Normal wheel scrolls page or nested scroll container natively.

## 6. Select vs Interact Mode Interception
- **Select Mode** (default):
  - Capture-phase handlers intercept:
    - `click`: stops propagation and prevents default. Dispatches `SELECTION_CLICK` or `SELECTION_CLEAR`.
    - `submit`: prevents form submission.
    - `focusin`: prevents inputs from taking focus.
    - `keydown` (Space, Enter): prevents activating buttons/links.
  - All elements remain inspectable: disabled buttons, disabled inputs, SVGs, images, elements under sticky headers.
- **Interact Mode**:
  - All interception handlers are disabled.
  - Page behaves 100% normally: links navigate, buttons act, inputs focus.
  - Selection overlays hide; selection remains preserved in state and reappears when switching back to Select mode if elements still exist.

## 7. Layers Tree Model & Lazy Loading
- **Lazy Loading**:
  - Top level: children of `<body>`.
  - Children fetched on first expansion via `GET_CHILDREN(screenId, nodeId, requestId, version)`.
  - 3-second timeout: If page does not answer within 3s, row shows *"Couldn't load"* with Retry button.
  - Collapsing/re-expanding increments `nodeVersion`; responses for outdated versions are discarded without corrupting tree.
- **Layers ↔ Preview Sync**:
  - Hover row → renders hover outline in preview.
  - Hover preview element → highlights corresponding layer row. If inside collapsed parent, highlights nearest visible ancestor row (never auto-expands on hover).
  - Select preview element → requests ancestor chain, auto-expands ancestors, highlights row, scrolls panel into view.
  - Click row → selects element. If element is out of iframe viewport, scrolls only that iframe page.
- **Keyboard in Layers Panel**:
  - Arrow Up / Down: previous / next visible row.
  - Arrow Right: expand row (or move to first child if already expanded).
  - Arrow Left: collapse row (or move to parent if already collapsed).

## 8. Search Model
- **Full Tree Search**:
  - Host dispatches `SEARCH_TREE(query, requestId)` to page agent.
  - Page agent searches complete DOM tree (including unloaded nodes).
  - Returns matching node IDs and full ancestor chains.
  - Host stores `normalExpandedIds` and activates `searchExpandedIds`.
  - When search is cleared: restores `normalExpandedIds` exactly as they were before search.

## 9. Inspector Model
- **Single Element**:
  - Live properties: name, tag, id, classes, rounded width × height, page position, first 120 chars text, colors, font properties.
  - Details API (`GET /elements/:key`):
    - `data-key` missing → "No details".
    - 404 response → "No details for this element" (not an error).
    - 5xx / Network / Malformed JSON → Details error with Retry.
  - `selectionVersion` counter: if selection changes while Details are in flight, response is discarded.
- **Multi-Element**:
  - Header: "N elements".
  - Live properties: shared value or "Mixed".
  - Details section is omitted.

## 10. Error Isolation & Normalized Reporting
- **6 Independent Regions**:
  1. `board`: Screens API failure → Board error card with Retry.
  2. `preview`: Connection failure or 10s timeout → Preview card error with Retry.
  3. `layers`: Layers panel error boundary with Retry.
  4. `layers-row`: Child load timeout (>3s) → Row error state with Retry.
  5. `details`: Elements API error/malformed response → Details error with Retry (Live inspector stays functional).
  6. `inspector`: Inspector render error boundary with Retry.
- **Page Errors**:
  - Caught via `window.onerror` and `unhandledrejection`.
  - Badge on preview: "Page error" with tooltip showing error message.
- **Error Normalization**:
  - Central function `reportRegionFailure({ region, screenId, elementKey, error, failureKey })`.
  - Guarantees **exactly one call to `report()`** per failure lifecycle.
  - Retry triggers a new failure lifecycle.
  - Aborted / cancelled / replaced requests are never reported.
- **Dev Failure Menu**:
  - Dropdown to simulate: Screens API failure, Preview connection timeout, Layer load timeout, Details 500, Details malformed, Inspector render crash, Page error.

## 11. Navigation Handling
- Page agent detects navigation via `pagehide` / `beforeunload`.
- New page executes `agent.js`, generates fresh `sessionId`, posts `READY`.
- Host invalidates old session, clears selection on that preview, resets layers, restores active mode, and refreshes root tree nodes.
