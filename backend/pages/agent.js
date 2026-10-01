// Figr Page Agent - Embedded script for cross-origin preview iframes
// Communicates with Host application via window.postMessage

(() => {
  if (window.__FIGR_AGENT_LOADED__) return;
  window.__FIGR_AGENT_LOADED__ = true;

  let sessionId = 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
  let screenId = null;
  let hostOrigin = null; // Discovered on INIT or initial handshake
  let currentMode = 'select'; // 'select' | 'interact'
  let isPointerOverIframe = false;
  let lastHoveredIdentity = null;
  let trackedSelectedIdentities = []; // string[]

  // --- Element Inspectability Filter ---
  function isInspectableElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'html' || tag === 'body' || tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta') {
      return false;
    }
    return true;
  }

  // --- Element Naming ---
  // Name: data-name if present, otherwise tag + first class, or tag + id, or tag
  function getElementName(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
    const dataName = el.getAttribute('data-name');
    if (dataName && dataName.trim()) return dataName.trim();

    const tag = el.tagName.toLowerCase();
    const classList = Array.from(el.classList).filter((c) => Boolean(c) && !c.startsWith('figr-'));
    if (classList.length > 0) {
      return `${tag}.${classList[0]}`;
    }
    if (el.id && el.id !== 'root' && el.id !== 'app') {
      return `${tag}#${el.id}`;
    }
    return tag;
  }

  // --- Element Identity Strategy ---
  // Order of preference:
  // 1. data-key
  // 2. id (unique, stable)
  // 3. Anchor + Semantic Fingerprint (tag, class, data-name, normalized text, attributes, ordinal)
  function getDirectTextSnippet(el) {
    if (!el) return '';
    let text = '';
    for (let node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE && text.length < 40) {
        text += (node.textContent || '').trim() + ' ';
      }
      if (text.length >= 60) break;
    }
    return text.replace(/\s+/g, ' ').trim().slice(0, 40);
  }

  function getElementIdentity(el) {
    if (!isInspectableElement(el)) return null;

    const dataKey = el.getAttribute('data-key');
    if (dataKey) {
      return `key:${dataKey}`;
    }

    if (el.id && el.id !== 'root' && el.id !== 'app') {
      return `id:${el.id}`;
    }

    // Locate nearest ancestor anchor
    let ancestor = el.parentElement;
    let anchorDesc = 'body';
    while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
      const aKey = ancestor.getAttribute('data-key');
      if (aKey) {
        anchorDesc = `key:${aKey}`;
        break;
      }
      if (ancestor.id && ancestor.id !== 'root' && ancestor.id !== 'app') {
        anchorDesc = `id:${ancestor.id}`;
        break;
      }
      ancestor = ancestor.parentElement;
    }

    const tag = el.tagName.toLowerCase();
    const firstClass = el.classList.length > 0 ? `.${el.classList[0]}` : '';
    const dataName = el.getAttribute('data-name') ? `[name="${el.getAttribute('data-name')}"]` : '';
    const textSnippet = getDirectTextSnippet(el);
    const textSig = textSnippet ? `[text="${encodeURIComponent(textSnippet)}"]` : '';

    // Relative ordinal among identical signature peers under ancestor
    let ordinal = 0;
    let sibling = el.previousElementSibling;
    while (sibling) {
      if (
        sibling.tagName === el.tagName &&
        sibling.getAttribute('data-name') === el.getAttribute('data-name') &&
        getDirectTextSnippet(sibling) === textSnippet
      ) {
        ordinal++;
      }
      sibling = sibling.previousElementSibling;
    }

    return `${anchorDesc} > ${tag}${firstClass}${dataName}${textSig}${ordinal > 0 ? `#${ordinal}` : ''}`;
  }

  // --- Identity Resolver ---
  function resolveElementByIdentity(idStr) {
    if (!idStr || typeof idStr !== 'string') return null;

    if (idStr.startsWith('key:') && !idStr.includes(' > ')) {
      const key = idStr.slice(4);
      return document.querySelector(`[data-key="${CSS.escape(key)}"]`);
    }

    if (idStr.startsWith('id:') && !idStr.includes(' > ')) {
      const id = idStr.slice(3);
      return document.getElementById(id);
    }

    const parts = idStr.split(' > ');
    if (parts.length === 2) {
      const anchorDesc = parts[0];
      const targetDesc = parts[1];

      let anchorEl = document.body;
      if (anchorDesc.startsWith('key:')) {
        anchorEl = document.querySelector(`[data-key="${CSS.escape(anchorDesc.slice(4))}"]`);
      } else if (anchorDesc.startsWith('id:')) {
        anchorEl = document.getElementById(anchorDesc.slice(3));
      }
      if (!anchorEl) return null;

      const tagMatch = targetDesc.match(/^([a-z0-9]+)/i);
      if (!tagMatch) return null;
      const tag = tagMatch[1].toLowerCase();

      const nameMatch = targetDesc.match(/\[name="([^"]+)"\]/);
      const targetName = nameMatch ? nameMatch[1] : null;

      const textMatch = targetDesc.match(/\[text="([^"]+)"\]/);
      const targetText = textMatch ? decodeURIComponent(textMatch[1]) : null;

      const ordinalMatch = targetDesc.match(/#(\d+)$/);
      const targetOrdinal = ordinalMatch ? parseInt(ordinalMatch[1], 10) : 0;

      const candidates = anchorEl.querySelectorAll(tag);
      let matchedCount = 0;
      let matchedEl = null;

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!isInspectableElement(candidate)) continue;
        if (targetName && candidate.getAttribute('data-name') !== targetName) continue;
        if (targetText) {
          const candText = getDirectTextSnippet(candidate);
          if (candText !== targetText) continue;
        }

        if (matchedCount === targetOrdinal) {
          matchedEl = candidate;
          break;
        }
        matchedCount++;
      }

      if (matchedEl) return matchedEl;

      // Fallback with data-name if text shifted
      if (targetName) {
        const byName = anchorEl.querySelector(`[data-name="${CSS.escape(targetName)}"]`);
        if (byName && isInspectableElement(byName)) return byName;
      }
    }

    // Refuse to guess if ambiguous or not found
    return null;
  }

  // --- Geometry Helpers ---
  function getElementRect(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    const rect = el.getBoundingClientRect();
    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
    };
  }

  // --- PostMessage Helpers ---
  function postToHost(type, payload = {}, requestId = undefined, version = undefined) {
    try {
      const targetOrigin = hostOrigin || '*';
      window.parent.postMessage(
        {
          figr: true,
          type,
          screenId,
          sessionId,
          requestId,
          version,
          payload,
        },
        targetOrigin
      );
    } catch (err) {
      console.error('[Page Agent] Failed to postMessage', err);
    }
  }

  // --- Live Info ---
  function getLiveInfo(el) {
    if (!isInspectableElement(el)) return null;
    const computed = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    const fullText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    const textSnippet = fullText.slice(0, 120);

    return {
      name: getElementName(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      classes: Array.from(el.classList).filter((c) => Boolean(c) && !c.startsWith('figr-')),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      pageX: Math.round(rect.left + scrollX),
      pageY: Math.round(rect.top + scrollY),
      text: textSnippet,
      textColor: computed.color,
      backgroundColor: computed.backgroundColor,
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
    };
  }

  // --- Tree Serialization for Layers ---
  function serializeNode(el, parentId = null, depth = 0) {
    const id = getElementIdentity(el);
    const childInspectable = Array.from(el.children).filter(isInspectableElement);
    return {
      id,
      name: getElementName(el),
      tag: el.tagName.toLowerCase(),
      dataKey: el.getAttribute('data-key') || undefined,
      hasChildren: childInspectable.length > 0,
      parentId,
      depth,
    };
  }

  function getRootNodes() {
    const inspectable = Array.from(document.body.children).filter(isInspectableElement);
    return inspectable.map((child) => serializeNode(child, null, 0));
  }

  function getChildrenNodes(parentIdStr) {
    const parentEl = resolveElementByIdentity(parentIdStr);
    if (!parentEl) return [];
    const inspectable = Array.from(parentEl.children).filter(isInspectableElement);
    return inspectable.map((child) => serializeNode(child, parentIdStr, 1));
  }

  function getAncestorChain(targetIdStr) {
    const el = resolveElementByIdentity(targetIdStr);
    if (!el) return [];
    const chain = [];
    let current = el.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      if (isInspectableElement(current)) {
        chain.unshift(getElementIdentity(current));
      }
      current = current.parentElement;
    }
    return chain;
  }

  function searchEntireTree(query) {
    if (!query || !query.trim()) return { matches: [], materializedNodes: [] };
    const q = query.toLowerCase().trim();
    const matches = [];
    const nodeMap = new Map();

    function recordNode(el, parentId, depth) {
      const id = getElementIdentity(el);
      if (!id) return null;
      if (!nodeMap.has(id)) {
        const childInspectable = Array.from(el.children).filter(isInspectableElement);
        nodeMap.set(id, {
          id,
          name: getElementName(el),
          tag: el.tagName.toLowerCase(),
          dataKey: el.getAttribute('data-key') || undefined,
          hasChildren: childInspectable.length > 0,
          children: childInspectable.map(getElementIdentity).filter(Boolean),
          parentId,
          depth,
        });
      }
      return id;
    }

    function walk(el, parentId, depth) {
      if (!isInspectableElement(el)) return;
      const name = getElementName(el).toLowerCase();
      const tag = el.tagName.toLowerCase();
      const idStr = el.id ? el.id.toLowerCase() : '';
      const text = (el.innerText || el.textContent || '').slice(0, 80).toLowerCase();

      const isMatch = name.includes(q) || tag.includes(q) || idStr.includes(q) || text.includes(q);

      if (isMatch) {
        const id = getElementIdentity(el);
        const ancestors = [];
        let curr = el.parentElement;
        const chain = [];
        while (curr && curr !== document.body && curr !== document.documentElement) {
          if (isInspectableElement(curr)) {
            chain.unshift(curr);
          }
          curr = curr.parentElement;
        }

        let pId = null;
        let d = 0;
        for (let ancEl of chain) {
          const ancId = recordNode(ancEl, pId, d);
          ancestors.push(ancId);
          pId = ancId;
          d++;
        }

        recordNode(el, pId, d);
        matches.push({
          id,
          name: getElementName(el),
          tag,
          ancestors,
        });
      }

      for (let child of el.children) {
        walk(child, getElementIdentity(el), depth + 1);
      }
    }

    for (let bodyChild of document.body.children) {
      walk(bodyChild, null, 0);
    }

    return {
      matches,
      materializedNodes: Array.from(nodeMap.values()),
    };
  }

  // --- Keyboard Navigation in Tree ---
  function navigateKeyboard(currentId, action) {
    const currentEl = resolveElementByIdentity(currentId);
    if (!currentEl) return null;

    let targetEl = null;

    if (action === 'first_child') {
      const inspectable = Array.from(currentEl.children).filter(isInspectableElement);
      if (inspectable.length > 0) {
        targetEl = inspectable[0];
      }
    } else if (action === 'parent') {
      const parent = currentEl.parentElement;
      if (parent && parent !== document.body && parent !== document.documentElement && isInspectableElement(parent)) {
        targetEl = parent;
      }
    } else if (action === 'next_sibling') {
      const parent = currentEl.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(isInspectableElement);
        const idx = siblings.indexOf(currentEl);
        if (idx !== -1 && siblings.length > 1) {
          const nextIdx = (idx + 1) % siblings.length;
          targetEl = siblings[nextIdx];
        }
      }
    } else if (action === 'prev_sibling') {
      const parent = currentEl.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(isInspectableElement);
        const idx = siblings.indexOf(currentEl);
        if (idx !== -1 && siblings.length > 1) {
          const prevIdx = (idx - 1 + siblings.length) % siblings.length;
          targetEl = siblings[prevIdx];
        }
      }
    }

    if (!targetEl) return null;
    const targetId = getElementIdentity(targetEl);
    const bounds = getElementRect(targetEl);
    return {
      elementId: targetId,
      name: getElementName(targetEl),
      dataKey: targetEl.getAttribute('data-key') || undefined,
      bounds,
    };
  }

  // --- Hit Testing ---
  function getInspectableElementAtPoint(x, y) {
    const elements = document.elementsFromPoint(x, y);
    for (let el of elements) {
      if (isInspectableElement(el)) {
        return el;
      }
    }
    return null;
  }

  // --- Event Interceptors ---
  window.addEventListener(
    'pointermove',
    (e) => {
      isPointerOverIframe = true;
      if (currentMode !== 'select') return;

      const el = getInspectableElementAtPoint(e.clientX, e.clientY);
      if (!el) {
        if (lastHoveredIdentity !== null) {
          lastHoveredIdentity = null;
          postToHost('HOVER', { hovered: null });
        }
        return;
      }

      const id = getElementIdentity(el);
      if (id !== lastHoveredIdentity) {
        lastHoveredIdentity = id;
        const rect = getElementRect(el);
        postToHost('HOVER', {
          hovered: {
            elementId: id,
            name: getElementName(el),
            dataKey: el.getAttribute('data-key') || undefined,
            bounds: rect,
          },
        });
      }
    },
    { capture: true, passive: true }
  );

  function clearHover() {
    if (lastHoveredIdentity !== null) {
      lastHoveredIdentity = null;
      postToHost('HOVER', { hovered: null });
    }
  }

  window.addEventListener(
    'pointerleave',
    () => {
      isPointerOverIframe = false;
      clearHover();
    },
    { capture: true }
  );

  document.documentElement.addEventListener(
    'mouseleave',
    () => {
      isPointerOverIframe = false;
      clearHover();
    },
    { capture: true }
  );

  // Click handling in Select mode: prevent all normal interactions
  window.addEventListener(
    'click',
    (e) => {
      if (currentMode === 'select') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const el = getInspectableElementAtPoint(e.clientX, e.clientY);
        if (!el) {
          postToHost('SELECTION_CLEAR', {});
          return;
        }

        const id = getElementIdentity(el);
        const rect = getElementRect(el);
        postToHost('SELECTION_CLICK', {
          elementId: id,
          name: getElementName(el),
          dataKey: el.getAttribute('data-key') || undefined,
          bounds: rect,
          shiftKey: Boolean(e.shiftKey),
        });
      }
    },
    { capture: true }
  );

  // In Select mode, prevent submit, input focus, form action
  window.addEventListener(
    'submit',
    (e) => {
      if (currentMode === 'select') {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true }
  );

  window.addEventListener(
    'focusin',
    (e) => {
      if (currentMode === 'select' && e.target && typeof e.target.blur === 'function') {
        e.target.blur();
      }
    },
    { capture: true }
  );

  // Wheel handling: Ctrl/Cmd + wheel must zoom board; normal wheel scrolls iframe page
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        postToHost('BOARD_ZOOM', {
          deltaY: e.deltaY,
          clientX: e.clientX,
          clientY: e.clientY,
        });
      }
      // Else: normal wheel scrolls page natively! Do NOT preventDefault!
    },
    { capture: true, passive: false }
  );

  // Scroll notification to update overlays
  let scrollRaf = null;
  window.addEventListener(
    'scroll',
    () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null;
        notifyScrollOrGeometryChange();
      });
    },
    { capture: true, passive: true }
  );

  // Keyboard shortcut forwarding when iframe has focus
  window.addEventListener(
    'keydown',
    (e) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

      if (currentMode === 'select') {
        if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
        }
      }

      const monitoredKeys = ['v', 'V', 'i', 'I', 'Escape', 'Enter', 'Tab'];
      if (monitoredKeys.includes(e.key) && (!isInput || e.key === 'Escape' || currentMode === 'select')) {
        postToHost('KEYBOARD_SHORTCUT', {
          key: e.key,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
        });
      }
    },
    { capture: true }
  );

  // --- Geometry / Bounds Sync for Tracked Selection ---
  function notifyScrollOrGeometryChange() {
    if (!trackedSelectedIdentities || trackedSelectedIdentities.length === 0) return;
    const updates = [];
    const missing = [];

    for (let id of trackedSelectedIdentities) {
      const el = resolveElementByIdentity(id);
      if (el && isInspectableElement(el)) {
        updates.push({
          elementId: id,
          bounds: getElementRect(el),
          name: getElementName(el),
        });
      } else {
        missing.push(id);
      }
    }

    if (updates.length > 0 || missing.length > 0) {
      postToHost('PAGE_SCROLLED', {
        updates,
        missing,
      });
    }
  }

  // --- ResizeObserver for Tracked Elements ---
  const resizeObserver = new ResizeObserver(() => {
    notifyScrollOrGeometryChange();
  });
  resizeObserver.observe(document.documentElement);

  // --- MutationObserver for Live DOM Changes ---
  let mutationRaf = null;
  const observer = new MutationObserver(() => {
    if (mutationRaf) return;
    mutationRaf = requestAnimationFrame(() => {
      mutationRaf = null;
      handleDomMutation();
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

  function handleDomMutation() {
    const updates = [];
    const missing = [];

    for (let id of trackedSelectedIdentities) {
      const el = resolveElementByIdentity(id);
      if (el && isInspectableElement(el)) {
        updates.push({
          elementId: id,
          bounds: getElementRect(el),
          name: getElementName(el),
          live: getLiveInfo(el),
        });
      } else {
        missing.push(id);
      }
    }

    let hoveredUpdated = null;
    if (lastHoveredIdentity) {
      const hEl = resolveElementByIdentity(lastHoveredIdentity);
      if (hEl && isInspectableElement(hEl)) {
        hoveredUpdated = {
          elementId: lastHoveredIdentity,
          bounds: getElementRect(hEl),
          name: getElementName(hEl),
        };
      } else {
        lastHoveredIdentity = null;
        hoveredUpdated = null;
      }
    }

    postToHost('DOM_CHANGED', {
      updates,
      missing,
      hovered: hoveredUpdated,
    });
  }

  // --- Navigation Detection (Full Page, SPA History, bfcache) ---
  function handleNavigationChange(newUrl) {
    postToHost('NAVIGATION_START', { url: newUrl || window.location.href });
    // Invalidate old session and generate brand new session ID
    sessionId = 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    lastHoveredIdentity = null;
    trackedSelectedIdentities = [];

    // Announce new session READY to host
    setTimeout(() => {
      postToHost('READY', {
        url: window.location.href,
        pathname: window.location.pathname,
      });
    }, 10);
  }

  // Intercept history.pushState and history.replaceState
  try {
    const origPushState = history.pushState;
    if (typeof origPushState === 'function') {
      history.pushState = function (...args) {
        const res = origPushState.apply(this, args);
        handleNavigationChange(window.location.href);
        return res;
      };
    }

    const origReplaceState = history.replaceState;
    if (typeof origReplaceState === 'function') {
      history.replaceState = function (...args) {
        const res = origReplaceState.apply(this, args);
        handleNavigationChange(window.location.href);
        return res;
      };
    }
  } catch (err) {
    console.warn('[Page Agent] Failed to wrap history state', err);
  }

  window.addEventListener('popstate', () => {
    handleNavigationChange(window.location.href);
  });

  window.addEventListener('hashchange', () => {
    handleNavigationChange(window.location.href);
  });

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      handleNavigationChange(window.location.href);
    }
  });

  window.addEventListener('beforeunload', () => {
    postToHost('NAVIGATION_START', { url: window.location.href });
  });

  window.addEventListener('pagehide', () => {
    postToHost('NAVIGATION_START', { url: window.location.href });
  });

  // --- Error Handling ---
  window.addEventListener('error', (e) => {
    postToHost('PAGE_ERROR', {
      message: e.message || 'Unknown runtime error',
      filename: e.filename || '',
      lineno: e.lineno || 0,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    postToHost('PAGE_ERROR', {
      message: msg || 'Unhandled Promise rejection',
    });
  });

  // --- Host Message Dispatcher ---
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || data.figr !== true) return;

    if (hostOrigin && event.origin !== hostOrigin) {
      console.warn('[Page Agent] Dropping message from untrusted origin', event.origin);
      return;
    }

    const { type, payload, requestId, version } = data;

    switch (type) {
      case 'INIT': {
        hostOrigin = event.origin;
        screenId = payload.screenId;
        currentMode = payload.mode || 'select';
        trackedSelectedIdentities = payload.selectedIdentities || [];
        postToHost('INIT_ACK', { screenId, currentMode }, requestId, version);
        break;
      }

      case 'SET_MODE': {
        currentMode = payload.mode;
        if (currentMode === 'interact') {
          clearHover();
        }
        break;
      }

      case 'TRACK_SELECTION': {
        trackedSelectedIdentities = payload.selectedIdentities || [];
        notifyScrollOrGeometryChange();
        break;
      }

      case 'GET_ROOT': {
        const rootNodes = getRootNodes();
        postToHost('ROOT', { rootNodes }, requestId, version);
        break;
      }

      case 'GET_CHILDREN': {
        const children = getChildrenNodes(payload.elementId);
        postToHost('CHILDREN', { parentId: payload.elementId, children }, requestId, version);
        break;
      }

      case 'GET_ANCESTORS': {
        const ancestors = getAncestorChain(payload.elementId);
        postToHost('ANCESTORS', { elementId: payload.elementId, ancestors }, requestId, version);
        break;
      }

      case 'GET_LIVE_INFO': {
        const el = resolveElementByIdentity(payload.elementId);
        const live = el ? getLiveInfo(el) : null;
        postToHost('LIVE_INFO', { elementId: payload.elementId, live }, requestId, version);
        break;
      }

      case 'HOVER_BY_ID': {
        if (currentMode !== 'select') return;
        const el = resolveElementByIdentity(payload.elementId);
        if (el) {
          lastHoveredIdentity = payload.elementId;
          postToHost('HOVER', {
            hovered: {
              elementId: payload.elementId,
              name: getElementName(el),
              dataKey: el.getAttribute('data-key') || undefined,
              bounds: getElementRect(el),
            },
          });
        }
        break;
      }

      case 'CLEAR_HOVER': {
        clearHover();
        break;
      }

      case 'SCROLL_TO': {
        const el = resolveElementByIdentity(payload.elementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          setTimeout(notifyScrollOrGeometryChange, 300);
        }
        break;
      }

      case 'SEARCH_TREE': {
        const searchRes = searchEntireTree(payload.query);
        postToHost(
          'SEARCH_RESULTS',
          {
            query: payload.query,
            matches: searchRes.matches,
            materializedNodes: searchRes.materializedNodes,
          },
          requestId,
          version
        );
        break;
      }

      case 'KEYBOARD_NAV': {
        const result = navigateKeyboard(payload.currentElementId, payload.action);
        postToHost('KEYBOARD_NAV_RESULT', { result }, requestId, version);
        break;
      }

      case 'DEV_CRASH': {
        throw new Error('Triggered synthetic page crash for Figr evaluation');
      }

      default:
        break;
    }
  });

  // Announce ready to parent
  postToHost('READY', {
    url: window.location.href,
    pathname: window.location.pathname,
  });
})();
