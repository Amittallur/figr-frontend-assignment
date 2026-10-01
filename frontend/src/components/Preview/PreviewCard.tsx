import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ScreenItem } from '../../types/screens';
import { useBoardStore } from '../../store/boardStore';
import { useSelectionStore } from '../../store/selectionStore';
import { useLayersStore } from '../../store/layersStore';
import { useErrorStore } from '../../store/errorStore';
import { PreviewOverlay } from './PreviewOverlay';
import { HostToIframeMessage, IframeToHostMessage } from '../../types/protocol';
import { AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';

interface Props {
  screen: ScreenItem;
}

const PAGES_ORIGIN = 'http://localhost:4001';
const CONNECTION_TIMEOUT_MS = 10000;

export const PreviewCard: React.FC<Props> = ({ screen }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentSessionId = useRef<string | null>(null);
  const connectionTimer = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const activeScreenId = useBoardStore((s) => s.activeScreenId);
  const mode = useBoardStore((s) => s.mode);
  const scale = useBoardStore((s) => s.scale);
  const selectedItems = useSelectionStore((s) => s.selectedItems);

  const previewError = useErrorStore((s) => s.previewErrors[screen.id]);
  const pageError = useErrorStore((s) => s.pageErrors[screen.id]);
  const devFailPreviewTimeout = useErrorStore((s) => s.devFailPreviewTimeout);

  const isActive = activeScreenId === screen.id;

  // Helper to send message to iframe
  const postToIframe = useCallback(
    (msg: Omit<HostToIframeMessage, 'figr' | 'screenId'>) => {
      if (!iframeRef.current || !iframeRef.current.contentWindow) return;
      try {
        const fullMsg: HostToIframeMessage = {
          figr: true,
          screenId: screen.id,
          sessionId: currentSessionId.current || undefined,
          ...msg,
        };
        iframeRef.current.contentWindow.postMessage(fullMsg, PAGES_ORIGIN);
      } catch (err) {
        console.error(`[Preview:${screen.id}] Failed to postMessage`, err);
      }
    },
    [screen.id]
  );

  // Sync mode changes to iframe
  useEffect(() => {
    if (isConnected) {
      postToIframe({
        type: 'SET_MODE',
        payload: { mode },
      });
    }
  }, [mode, isConnected, postToIframe]);

  // Sync selected element identities for geometry tracking
  useEffect(() => {
    if (isConnected) {
      const selectedForScreen = selectedItems
        .filter((it) => it.screenId === screen.id && !it.isMissing)
        .map((it) => it.elementId);

      postToIframe({
        type: 'TRACK_SELECTION',
        payload: { selectedIdentities: selectedForScreen },
      });
    }
  }, [selectedItems, isConnected, screen.id, postToIframe]);

  // Handle connection timeout
  const startConnectionTimeout = useCallback(() => {
    if (connectionTimer.current) clearTimeout(connectionTimer.current);

    connectionTimer.current = setTimeout(() => {
      setIsConnected(false);
      useErrorStore
        .getState()
        .handleFailure(
          'preview',
          screen.id,
          undefined,
          new Error("Couldn't connect to this preview"),
          'connection_timeout'
        );
    }, CONNECTION_TIMEOUT_MS);
  }, [screen.id]);

  useEffect(() => {
    startConnectionTimeout();
    return () => {
      if (connectionTimer.current) clearTimeout(connectionTimer.current);
    };
  }, [startConnectionTimeout]);

  // Dev failure simulation for preview connection timeout
  useEffect(() => {
    if (devFailPreviewTimeout === screen.id) {
      setIsConnected(false);
      useErrorStore
        .getState()
        .handleFailure(
          'preview',
          screen.id,
          undefined,
          new Error("Couldn't connect to this preview (Simulated)"),
          'connection_timeout'
        );
    }
  }, [devFailPreviewTimeout, screen.id]);

  // Retry preview connection
  const handleRetry = () => {
    useErrorStore
      .getState()
      .retryRegion('preview', screen.id, undefined, 'connection_timeout');

    setIsConnected(false);
    startConnectionTimeout();

    // Reload iframe
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  // Keyboard navigation helper
  const handleKeyboardNav = useCallback(
    (action: 'first_child' | 'parent' | 'next_sibling' | 'prev_sibling') => {
      const selections = useSelectionStore
        .getState()
        .selectedItems.filter((it) => it.screenId === screen.id);
      if (selections.length === 0) return;

      const lastSelected = selections[selections.length - 1];
      postToIframe({
        type: 'KEYBOARD_NAV',
        payload: {
          currentElementId: lastSelected.elementId,
          action,
        },
      });
    },
    [screen.id, postToIframe]
  );

  // postMessage event listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== PAGES_ORIGIN) return;
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
        return;
      }

      const data: IframeToHostMessage = event.data;
      if (!data || data.figr !== true) return;

      const { type, payload, sessionId } = data;

      switch (type) {
        case 'READY': {
          if (connectionTimer.current) clearTimeout(connectionTimer.current);
          setIsConnected(true);
          currentSessionId.current = sessionId;

          // Clear any previous preview error
          useErrorStore.getState().setPreviewError(screen.id, null);

          // Clear previous selection for this screen on reload/navigation
          useSelectionStore.getState().clearPreviewSelection(screen.id);
          useLayersStore.getState().resetScreenLayers(screen.id);

          // Initialize page agent with screenId and current mode
          const currentSelected = useSelectionStore
            .getState()
            .selectedItems.filter((it) => it.screenId === screen.id)
            .map((it) => it.elementId);

          postToIframe({
            type: 'INIT',
            payload: {
              screenId: screen.id,
              mode: useBoardStore.getState().mode,
              selectedIdentities: currentSelected,
            },
          });

          // Fetch root nodes for layers panel
          postToIframe({ type: 'GET_ROOT' });
          break;
        }

        case 'INIT_ACK': {
          setIsConnected(true);
          break;
        }

        case 'ROOT': {
          if (sessionId !== currentSessionId.current) return;
          if (payload && payload.rootNodes) {
            useLayersStore.getState().initScreenLayers(screen.id, payload.rootNodes);
          }
          break;
        }

        case 'CHILDREN': {
          if (sessionId !== currentSessionId.current) return;
          if (payload && payload.parentId && payload.children) {
            useLayersStore
              .getState()
              .setNodeChildren(screen.id, payload.parentId, payload.children, data.version);
          }
          break;
        }

        case 'HOVER': {
          if (sessionId !== currentSessionId.current) return;
          if (useBoardStore.getState().mode !== 'select') return;

          if (payload.hovered) {
            useSelectionStore.getState().setHoveredItem({
              screenId: screen.id,
              elementId: payload.hovered.elementId,
              name: payload.hovered.name,
              dataKey: payload.hovered.dataKey,
              bounds: payload.hovered.bounds,
            });
          } else {
            // If hovered is null and was on this screen, clear it
            const currentHover = useSelectionStore.getState().hoveredItem;
            if (currentHover && currentHover.screenId === screen.id) {
              useSelectionStore.getState().clearHover();
            }
          }
          break;
        }

        case 'SELECTION_CLICK': {
          if (sessionId !== currentSessionId.current) return;
          if (useBoardStore.getState().mode !== 'select') return;

          useSelectionStore
            .getState()
            .selectElement(
              screen.id,
              payload.elementId,
              payload.name,
              payload.bounds,
              payload.dataKey,
              payload.shiftKey
            );

          // Request ancestor chain for auto-expansion in layers panel
          postToIframe({
            type: 'GET_ANCESTORS',
            payload: { elementId: payload.elementId },
          });
          break;
        }

        case 'SELECTION_CLEAR': {
          if (sessionId !== currentSessionId.current) return;
          if (useBoardStore.getState().mode !== 'select') return;
          useSelectionStore.getState().clearSelection();
          break;
        }

        case 'ANCESTORS': {
          if (sessionId !== currentSessionId.current) return;
          if (payload && payload.ancestors) {
            useLayersStore.getState().expandAncestors(screen.id, payload.ancestors);
          }
          break;
        }

        case 'PAGE_SCROLLED': {
          if (sessionId !== currentSessionId.current) return;
          if (payload && payload.updates) {
            for (const upd of payload.updates) {
              useSelectionStore
                .getState()
                .updateGeometry(screen.id, upd.elementId, upd.bounds, upd.name);
            }
          }
          if (payload && payload.missing) {
            useSelectionStore.getState().markElementsMissing(screen.id, payload.missing);
          }
          break;
        }

        case 'DOM_CHANGED': {
          if (sessionId !== currentSessionId.current) return;
          if (payload && payload.updates) {
            for (const upd of payload.updates) {
              useSelectionStore
                .getState()
                .updateGeometry(screen.id, upd.elementId, upd.bounds, upd.name);
            }
          }
          if (payload && payload.missing) {
            useSelectionStore.getState().markElementsMissing(screen.id, payload.missing);
          }
          if (payload && payload.hovered) {
            useSelectionStore.getState().setHoveredItem({
              screenId: screen.id,
              elementId: payload.hovered.elementId,
              name: payload.hovered.name,
              bounds: payload.hovered.bounds,
            });
          }
          break;
        }

        case 'BOARD_ZOOM': {
          if (!iframeRef.current) return;
          const iframeRect = iframeRef.current.getBoundingClientRect();
          // Transform iframe client coordinates into host client coordinates
          const hostPointerX = iframeRect.left + payload.clientX * scale;
          const hostPointerY = iframeRect.top + payload.clientY * scale;

          useBoardStore.getState().zoomAt(payload.deltaY, hostPointerX, hostPointerY);
          break;
        }

        case 'KEYBOARD_SHORTCUT': {
          const { key, shiftKey } = payload;
          if (key === 'v' || key === 'V') {
            useBoardStore.getState().setMode('select');
          } else if (key === 'i' || key === 'I') {
            useBoardStore.getState().setMode('interact');
          } else if (key === 'Escape') {
            useSelectionStore.getState().clearSelection();
          } else if (key === 'Enter') {
            if (shiftKey) {
              handleKeyboardNav('parent');
            } else {
              handleKeyboardNav('first_child');
            }
          } else if (key === 'Tab') {
            if (shiftKey) {
              handleKeyboardNav('prev_sibling');
            } else {
              handleKeyboardNav('next_sibling');
            }
          }
          break;
        }

        case 'KEYBOARD_NAV_RESULT': {
          if (sessionId !== currentSessionId.current) return;
          if (payload && payload.result) {
            const { elementId, name, bounds, dataKey } = payload.result;
            useSelectionStore
              .getState()
              .replaceSelection(screen.id, elementId, name, bounds, dataKey);

            postToIframe({
              type: 'GET_ANCESTORS',
              payload: { elementId },
            });
          }
          break;
        }

        case 'PAGE_ERROR': {
          if (payload && payload.message) {
            useErrorStore.getState().setPageError(screen.id, payload.message);
          }
          break;
        }

        case 'NAVIGATION_START': {
          currentSessionId.current = null;
          useSelectionStore.getState().clearPreviewSelection(screen.id);
          useLayersStore.getState().resetScreenLayers(screen.id);
          setIsConnected(false);
          startConnectionTimeout();
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [screen.id, postToIframe, scale, startConnectionTimeout, handleKeyboardNav]);

  return (
    <div
      className={`preview-card ${isActive ? 'active' : ''}`}
      data-screen-id={screen.id}
    >
      <div className="preview-header">
        <div className="preview-title-group">
          <span className="preview-name">{screen.name}</span>
          {isActive && <span className="preview-badge-active">Active</span>}
          {pageError && (
            <div className="preview-page-error-badge">
              <AlertCircle size={12} />
              <span>Page error</span>
              <div className="error-tooltip">{pageError}</div>
            </div>
          )}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {screen.id}
        </span>
      </div>

      <div className="preview-frame-container">
        {previewError && (
          <div className="preview-error-overlay">
            <AlertTriangle size={32} color="#ef4444" />
            <div className="preview-error-title">Couldn't connect to this preview</div>
            <div className="preview-error-desc">{previewError}</div>
            <button className="btn-retry" onClick={handleRetry}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={screen.url}
          title={screen.name}
          className="preview-iframe"
          data-screen-id={screen.id}
        />

        <PreviewOverlay screenId={screen.id} />
      </div>
    </div>
  );
};
