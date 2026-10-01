import React, { useState, useRef, useEffect } from 'react';
import { useErrorStore } from '../../store/errorStore';
import { useBoardStore } from '../../store/boardStore';
import { AlertCircle, ChevronDown, Check, Bug } from 'lucide-react';

export const DevFailureMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    devFailScreens,
    setDevFailScreens,
    devFailPreviewTimeout,
    setDevFailPreviewTimeout,
    devFailLayerTimeout,
    setDevFailLayerTimeout,
    devFailDetails500,
    setDevFailDetails500,
    devFailDetailsMalformed,
    setDevFailDetailsMalformed,
    devFailInspectorRender,
    setDevFailInspectorRender,
  } = useErrorStore();

  const activeScreenId = useBoardStore((s) => s.activeScreenId);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const triggerPageCrash = () => {
    if (!activeScreenId) {
      alert('Select an element in a preview first to target that preview.');
      return;
    }
    const iframe = document.querySelector<HTMLIFrameElement>(
      `iframe[data-screen-id="${activeScreenId}"]`
    );
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          figr: true,
          type: 'DEV_CRASH',
          screenId: activeScreenId,
        },
        '*'
      );
    }
    setIsOpen(false);
  };

  return (
    <div className="dev-menu-dropdown" ref={menuRef}>
      <button
        className="dev-menu-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Simulate failure scenarios for assignment evaluation"
      >
        <Bug size={14} />
        <span>Dev Failure Menu</span>
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div className="dev-menu-content">
          <div
            style={{
              padding: '6px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '4px',
            }}
          >
            SIMULATE FAILURES (R6)
          </div>

          <button
            className="dev-menu-item"
            onClick={() => {
              setDevFailScreens(!devFailScreens);
              setIsOpen(false);
            }}
          >
            <span>Screens API Failure</span>
            {devFailScreens && <Check size={14} color="#ef4444" />}
          </button>

          <button
            className="dev-menu-item"
            onClick={() => {
              const target = devFailPreviewTimeout ? null : activeScreenId || 'scr-01';
              setDevFailPreviewTimeout(target);
              setIsOpen(false);
            }}
          >
            <span>Preview Connection Timeout (10s)</span>
            {devFailPreviewTimeout && <Check size={14} color="#ef4444" />}
          </button>

          <button
            className="dev-menu-item"
            onClick={() => {
              const target = devFailLayerTimeout ? null : activeScreenId || 'scr-01';
              setDevFailLayerTimeout(target);
              setIsOpen(false);
            }}
          >
            <span>Layer Load Timeout (3s)</span>
            {devFailLayerTimeout && <Check size={14} color="#ef4444" />}
          </button>

          <button
            className="dev-menu-item"
            onClick={() => {
              setDevFailDetails500(!devFailDetails500);
              setIsOpen(false);
            }}
          >
            <span>Details API 500 Failure</span>
            {devFailDetails500 && <Check size={14} color="#ef4444" />}
          </button>

          <button
            className="dev-menu-item"
            onClick={() => {
              setDevFailDetailsMalformed(!devFailDetailsMalformed);
              setIsOpen(false);
            }}
          >
            <span>Details API Malformed Body</span>
            {devFailDetailsMalformed && <Check size={14} color="#ef4444" />}
          </button>

          <button
            className="dev-menu-item"
            onClick={() => {
              setDevFailInspectorRender(!devFailInspectorRender);
              setIsOpen(false);
            }}
          >
            <span>Inspector Render Error</span>
            {devFailInspectorRender && <Check size={14} color="#ef4444" />}
          </button>

          <button
            className="dev-menu-item"
            onClick={triggerPageCrash}
            style={{ color: '#fca5a5' }}
          >
            <span>Trigger Page Error in Active Iframe</span>
            <AlertCircle size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
