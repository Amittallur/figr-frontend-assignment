import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { useLayersStore } from '../../store/layersStore';
import { useSelectionStore } from '../../store/selectionStore';
import { useErrorStore } from '../../store/errorStore';
import { TreeNode } from '../../types/layers';
import { LayerRow } from './LayerRow';
import { Layers, Search, X } from 'lucide-react';

const PAGES_ORIGIN = 'http://localhost:4001';
const CHILD_LOAD_TIMEOUT_MS = 3000;

export const LayersPanel: React.FC = () => {
  const activeScreenId = useBoardStore((s) => s.activeScreenId);
  const selectedItems = useSelectionStore((s) => s.selectedItems);
  const hoveredItem = useSelectionStore((s) => s.hoveredItem);

  const {
    screens,
    hoveredRowId,
    setHoveredRow,
    toggleExpandNode,
    setNodeExpanded,
    setNodeLoading,
    setNodeFailed,
    retryNode,
    setScrollPos,
    setSearch,
    clearSearch,
    incrementNodeVersion,
  } = useLayersStore();

  const devFailLayerTimeout = useErrorStore((s) => s.devFailLayerTimeout);

  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Active screen layers data
  const currentLayers = activeScreenId ? screens[activeScreenId] : undefined;

  // Helper to send message to active screen iframe
  const postToActiveIframe = useCallback(
    (type: string, payload: any = {}, version?: number) => {
      if (!activeScreenId) return;
      const iframe = document.querySelector<HTMLIFrameElement>(
        `iframe[data-screen-id="${activeScreenId}"]`
      );
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            figr: true,
            type,
            screenId: activeScreenId,
            version,
            payload,
          },
          PAGES_ORIGIN
        );
      }
    },
    [activeScreenId]
  );

  // Restore panel scroll position when active preview changes
  useEffect(() => {
    if (!activeScreenId || !listRef.current) return;
    const pos = useLayersStore.getState().screens[activeScreenId]?.scrollPos || 0;
    listRef.current.scrollTop = pos;
  }, [activeScreenId]);

  const handlePanelScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!activeScreenId) return;
    setScrollPos(activeScreenId, e.currentTarget.scrollTop);
  };

  // Load children on expand with 3-second timeout
  const handleToggleExpand = useCallback(
    (node: TreeNode) => {
      if (!activeScreenId || !currentLayers) return;

      const isExpanded = currentLayers.expandedIds.includes(node.id);
      if (isExpanded) {
        // Collapsing
        toggleExpandNode(activeScreenId, node.id);
        return;
      }

      // Expanding
      toggleExpandNode(activeScreenId, node.id);

      // If children not loaded yet, fetch from iframe
      if (!node.children || node.children.length === 0) {
        const version = incrementNodeVersion(activeScreenId, node.id);
        setNodeLoading(activeScreenId, node.id, true);
        setNodeFailed(activeScreenId, node.id, false);

        postToActiveIframe('GET_CHILDREN', { elementId: node.id }, version);

        // 3-second timeout
        const timer = setTimeout(() => {
          // Check if still loading
          const latestScreen = useLayersStore.getState().screens[activeScreenId];
          if (latestScreen && latestScreen.loadingIds.includes(node.id)) {
            setNodeFailed(activeScreenId, node.id, true);
            useErrorStore
              .getState()
              .handleFailure(
                'layers-row',
                activeScreenId,
                node.id,
                new Error("Couldn't load children (timeout)"),
                `row_load_${node.id}`
              );
          }
        }, CHILD_LOAD_TIMEOUT_MS);

        // If dev flag simulated failure
        if (devFailLayerTimeout === activeScreenId) {
          clearTimeout(timer);
          setTimeout(() => {
            setNodeFailed(activeScreenId, node.id, true);
            useErrorStore
              .getState()
              .handleFailure(
                'layers-row',
                activeScreenId,
                node.id,
                new Error("Couldn't load children (Simulated)"),
                `row_load_${node.id}`
              );
          }, 500);
        }
      }
    },
    [
      activeScreenId,
      currentLayers,
      toggleExpandNode,
      incrementNodeVersion,
      setNodeLoading,
      setNodeFailed,
      postToActiveIframe,
      devFailLayerTimeout,
    ]
  );

  const handleRetryNode = useCallback(
    (node: TreeNode) => {
      if (!activeScreenId) return;
      useErrorStore
        .getState()
        .retryRegion('layers-row', activeScreenId, node.id, `row_load_${node.id}`);

      const nextVer = retryNode(activeScreenId, node.id);
      postToActiveIframe('GET_CHILDREN', { elementId: node.id }, nextVer);

      setTimeout(() => {
        const latestScreen = useLayersStore.getState().screens[activeScreenId];
        if (latestScreen && latestScreen.loadingIds.includes(node.id)) {
          setNodeFailed(activeScreenId, node.id, true);
          useErrorStore
            .getState()
            .handleFailure(
              'layers-row',
              activeScreenId,
              node.id,
              new Error("Couldn't load children on retry"),
              `row_load_${node.id}`
            );
        }
      }, CHILD_LOAD_TIMEOUT_MS);
    },
    [activeScreenId, retryNode, postToActiveIframe, setNodeFailed]
  );

  // Search entire tree via page agent
  useEffect(() => {
    if (!activeScreenId) return;

    if (!searchQuery.trim()) {
      clearSearch(activeScreenId);
      return;
    }

    const timer = setTimeout(() => {
      postToActiveIframe('SEARCH_TREE', { query: searchQuery.trim() });
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, activeScreenId, postToActiveIframe, clearSearch]);

  // Handle incoming search results message
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.origin !== PAGES_ORIGIN) return;
      const data = e.data;
      if (!data || data.figr !== true) return;

      if (data.type === 'SEARCH_RESULTS' && activeScreenId && data.screenId === activeScreenId) {
        const { matches } = data.payload;
        if (matches && Array.isArray(matches)) {
          const matchIds = matches.map((m: any) => m.id);
          const ancestorIds = matches.flatMap((m: any) => m.ancestors || []);
          setSearch(activeScreenId, searchQuery, matchIds, ancestorIds);
        }
      }
    };

    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [activeScreenId, searchQuery, setSearch]);

  // Row selection handler
  const handleSelectNode = useCallback(
    (node: TreeNode, isShift: boolean) => {
      if (!activeScreenId) return;

      if (isShift) {
        useSelectionStore.getState().selectElement(
          activeScreenId,
          node.id,
          node.name,
          { x: 0, y: 0, width: 0, height: 0 },
          node.dataKey,
          true
        );
      } else {
        useSelectionStore.getState().selectElement(
          activeScreenId,
          node.id,
          node.name,
          { x: 0, y: 0, width: 0, height: 0 },
          node.dataKey,
          false
        );
      }

      // Scroll iframe page only to element if out of view
      postToActiveIframe('SCROLL_TO', { elementId: node.id });
    },
    [activeScreenId, postToActiveIframe]
  );

  // Row hover handler
  const handleHoverNode = useCallback(
    (node: TreeNode | null) => {
      if (!activeScreenId) return;

      if (node) {
        setHoveredRow(activeScreenId, node.id);
        postToActiveIframe('HOVER_BY_ID', { elementId: node.id });
      } else {
        setHoveredRow(null, null);
        postToActiveIframe('CLEAR_HOVER');
        useSelectionStore.getState().clearHover();
      }
    },
    [activeScreenId, setHoveredRow, postToActiveIframe]
  );

  // Find nearest visible row for preview hover highlight
  const getEffectiveHoveredNodeId = useCallback((): string | null => {
    if (!currentLayers) return null;
    const hoveredInPreview =
      hoveredItem && hoveredItem.screenId === activeScreenId
        ? hoveredItem.elementId
        : null;

    const targetId = hoveredRowId?.nodeId || hoveredInPreview;
    if (!targetId) return null;

    let current = currentLayers.nodes[targetId];
    if (!current) return null;

    // Check if ancestors are all expanded; if not, return nearest visible ancestor
    let ancestor = current.parentId ? currentLayers.nodes[current.parentId] : null;
    let nearestVisibleId = current.id;

    while (ancestor) {
      if (!currentLayers.expandedIds.includes(ancestor.id)) {
        nearestVisibleId = ancestor.id;
      }
      ancestor = ancestor.parentId ? currentLayers.nodes[ancestor.parentId] : null;
    }

    return nearestVisibleId;
  }, [currentLayers, hoveredItem, activeScreenId, hoveredRowId]);

  const effectiveHoveredId = getEffectiveHoveredNodeId();

  // Keyboard navigation when layers list is focused:
  // Arrow Up / Down, Arrow Right (expand/first child), Arrow Left (collapse/parent)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!currentLayers) return;

    // Collect all visible row IDs in order
    const visibleRowIds: string[] = [];
    const traverse = (nodeId: string) => {
      visibleRowIds.push(nodeId);
      const n = currentLayers.nodes[nodeId];
      if (n && currentLayers.expandedIds.includes(nodeId) && n.children) {
        for (const c of n.children) traverse(c);
      }
    };
    for (const rootId of currentLayers.rootIds) traverse(rootId);

    const activeSelections = selectedItems.filter(
      (it) => it.screenId === activeScreenId
    );
    const lastSelectedId =
      activeSelections.length > 0
        ? activeSelections[activeSelections.length - 1].elementId
        : visibleRowIds[0];

    const currentIndex = visibleRowIds.indexOf(lastSelectedId);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(visibleRowIds.length - 1, currentIndex + 1);
      const nextId = visibleRowIds[nextIndex];
      const node = currentLayers.nodes[nextId];
      if (node) handleSelectNode(node, false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(0, currentIndex - 1);
      const prevId = visibleRowIds[prevIndex];
      const node = currentLayers.nodes[prevId];
      if (node) handleSelectNode(node, false);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (!lastSelectedId) return;
      const node = currentLayers.nodes[lastSelectedId];
      if (!node) return;

      const isExpanded = currentLayers.expandedIds.includes(node.id);
      if (!isExpanded && node.hasChildren) {
        handleToggleExpand(node);
      } else if (isExpanded && node.children && node.children.length > 0) {
        const firstChild = currentLayers.nodes[node.children[0]];
        if (firstChild) handleSelectNode(firstChild, false);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (!lastSelectedId) return;
      const node = currentLayers.nodes[lastSelectedId];
      if (!node) return;

      const isExpanded = currentLayers.expandedIds.includes(node.id);
      if (isExpanded) {
        setNodeExpanded(activeScreenId!, node.id, false);
      } else if (node.parentId) {
        const parent = currentLayers.nodes[node.parentId];
        if (parent) handleSelectNode(parent, false);
      }
    }
  };

  // Render tree recursively
  const renderTreeNodes = (nodeIds: string[], depth = 0): React.ReactNode => {
    if (!currentLayers) return null;

    return nodeIds.map((id) => {
      const node = currentLayers.nodes[id];
      if (!node) return null;

      const isExpanded = currentLayers.expandedIds.includes(id);
      const isLoading = currentLayers.loadingIds.includes(id);
      const isFailed = currentLayers.failedIds.includes(id);
      const isSelected = selectedItems.some(
        (it) => it.screenId === activeScreenId && it.elementId === id && !it.isMissing
      );
      const isHovered = effectiveHoveredId === id;

      return (
        <React.Fragment key={id}>
          <LayerRow
            node={node}
            isExpanded={isExpanded}
            isLoading={isLoading}
            isFailed={isFailed}
            isSelected={isSelected}
            isHovered={isHovered}
            depth={depth}
            onSelect={handleSelectNode}
            onHover={handleHoverNode}
            onToggleExpand={handleToggleExpand}
            onRetry={handleRetryNode}
          />
          {isExpanded &&
            node.children &&
            node.children.length > 0 &&
            renderTreeNodes(node.children, depth + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <aside className="sidebar sidebar-left">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={14} />
          <span>Layers</span>
        </div>
        {activeScreenId && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {activeScreenId}
          </span>
        )}
      </div>

      {!activeScreenId ? (
        <div className="layers-empty">
          <p>Click something in a preview</p>
        </div>
      ) : (
        <div className="layers-container">
          <div className="layers-search-wrap">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={13}
                style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                className="layers-search-input"
                style={{ paddingLeft: '28px', paddingRight: '24px' }}
                placeholder="Search DOM tree..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  style={{
                    position: 'absolute',
                    right: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSearchQuery('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div
            ref={listRef}
            className="layers-list"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onScroll={handlePanelScroll}
          >
            {currentLayers && currentLayers.rootIds.length > 0 ? (
              renderTreeNodes(currentLayers.rootIds, 0)
            ) : (
              <div className="layers-empty" style={{ height: '140px' }}>
                <p>Loading document tree...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
