import React, { useEffect, useCallback } from 'react';
import { useSelectionStore } from '../../store/selectionStore';
import { useInspectorStore, MultiLiveProperty } from '../../store/inspectorStore';
import { useErrorStore } from '../../store/errorStore';
import { LiveSection } from './LiveSection';
import { DetailsSection } from './DetailsSection';
import { ErrorBoundary } from '../Common/ErrorBoundary';
import { LiveInfo } from '../../types/element';
import { Info, AlertCircle } from 'lucide-react';

const PAGES_ORIGIN = 'http://localhost:4001';

export const InspectorPanelInner: React.FC = () => {
  const selectedItems = useSelectionStore((s) => s.selectedItems);
  const isMissingSelected = useSelectionStore((s) => s.isMissingSelected);
  const selectionVersion = useSelectionStore((s) => s.selectionVersion);

  const liveInfo = useInspectorStore((s) => s.liveInfo);
  const multiLive = useInspectorStore((s) => s.multiLive);
  const multiCount = useInspectorStore((s) => s.multiCount);
  const setLiveInfo = useInspectorStore((s) => s.setLiveInfo);
  const setMultiLive = useInspectorStore((s) => s.setMultiLive);

  const devFailInspectorRender = useErrorStore((s) => s.devFailInspectorRender);

  // If dev failure menu triggered inspector render crash:
  if (devFailInspectorRender) {
    throw new Error('Inspector Render Crash (Simulated)');
  }

  // Active selections that are not marked missing
  const activeSelections = React.useMemo(
    () => selectedItems.filter((it) => !it.isMissing),
    [selectedItems]
  );

  // Helper to fetch live info from iframe
  const fetchLiveInfo = useCallback(
    (screenId: string, elementId: string, version: number) => {
      const iframe = document.querySelector<HTMLIFrameElement>(
        `iframe[data-screen-id="${screenId}"]`
      );
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            figr: true,
            type: 'GET_LIVE_INFO',
            screenId,
            version,
            payload: { elementId },
          },
          PAGES_ORIGIN
        );
      }
    },
    []
  );

  // When selection changes: request live info
  useEffect(() => {
    if (activeSelections.length === 0) {
      const st = useInspectorStore.getState();
      if (st.liveInfo !== null || st.multiLive !== null || st.details !== null) {
        st.clearInspector();
      }
      return;
    }

    if (activeSelections.length === 1) {
      const single = activeSelections[0];
      fetchLiveInfo(single.screenId, single.elementId, selectionVersion);
    } else {
      // Multiple items selected: request live info for each
      for (const item of activeSelections) {
        fetchLiveInfo(item.screenId, item.elementId, selectionVersion);
      }
    }
  }, [activeSelections, selectionVersion, fetchLiveInfo]);

  // Listen for LIVE_INFO message from iframe
  useEffect(() => {
    // Map to accumulate multi-selection live responses for current version
    const multiMap = new Map<string, LiveInfo>();

    const handleMsg = (e: MessageEvent) => {
      if (e.origin !== PAGES_ORIGIN) return;
      const data = e.data;
      if (!data || data.figr !== true) return;

      if (data.type === 'LIVE_INFO' && data.version === selectionVersion) {
        const live: LiveInfo | null = data.payload?.live;
        if (!live) return;

        if (activeSelections.length === 1) {
          setLiveInfo(live, selectionVersion);
        } else {
          multiMap.set(data.payload.elementId, live);

          // Once we have collected or as they arrive, compute shared vs Mixed
          const lives = Array.from(multiMap.values());
          if (lives.length > 0) {
            const computeProp = (getter: (l: LiveInfo) => any): MultiLiveProperty => {
              const firstVal = getter(lives[0]);
              const allSame = lives.every((l) => getter(l) === firstVal);
              return { value: firstVal, isMixed: !allSame };
            };

            const multiComputed: Record<string, MultiLiveProperty> = {
              tag: computeProp((l) => l.tag),
              id: computeProp((l) => l.id || '(none)'),
              classes: computeProp((l) => l.classes.join(', ') || '(none)'),
              dimensions: computeProp((l) => `${l.width} × ${l.height} px`),
              position: computeProp((l) => `X: ${l.pageX}px, Y: ${l.pageY}px`),
              text: computeProp((l) => l.text.slice(0, 30)),
              textColor: computeProp((l) => l.textColor),
              backgroundColor: computeProp((l) => l.backgroundColor),
              fontFamily: computeProp((l) => l.fontFamily.split(',')[0]),
              fontSize: computeProp((l) => l.fontSize),
              fontWeight: computeProp((l) => l.fontWeight),
            };

            setMultiLive(multiComputed, activeSelections.length, selectionVersion);
          }
        }
      }
    };

    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [selectionVersion, activeSelections, setLiveInfo, setMultiLive]);

  if (isMissingSelected) {
    return (
      <div className="inspector-empty">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={24} color="#f59e0b" />
          <p style={{ color: '#f59e0b', fontWeight: 600 }}>This element no longer exists</p>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            The page re-rendered and removed this node.
          </span>
        </div>
      </div>
    );
  }

  if (activeSelections.length === 0) {
    return (
      <div className="inspector-empty">
        <p>No element selected</p>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Click an element in a preview in Select mode
        </span>
      </div>
    );
  }

  if (activeSelections.length > 1) {
    return (
      <div className="inspector-container">
        {multiLive ? (
          <LiveSection isMulti={true} multiCount={multiCount} multiLive={multiLive} />
        ) : (
          <div className="inspector-empty" style={{ height: '120px' }}>
            <p>Loading {activeSelections.length} elements...</p>
          </div>
        )}
      </div>
    );
  }

  const singleSelected = activeSelections[0];

  return (
    <div className="inspector-container">
      {liveInfo ? (
        <LiveSection isMulti={false} live={liveInfo} />
      ) : (
        <div className="inspector-empty" style={{ height: '120px' }}>
          <p>Loading element properties...</p>
        </div>
      )}

      <DetailsSection
        screenId={singleSelected.screenId}
        elementKey={singleSelected.dataKey}
        selectionVersion={selectionVersion}
      />
    </div>
  );
};

export const InspectorPanel: React.FC = () => {
  return (
    <aside className="sidebar sidebar-right">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={14} />
          <span>Inspector</span>
        </div>
      </div>

      <ErrorBoundary region="inspector" fallbackTitle="Inspector Render Error">
        <InspectorPanelInner />
      </ErrorBoundary>
    </aside>
  );
};
