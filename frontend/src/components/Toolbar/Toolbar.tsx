import React, { useEffect } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { DevFailureMenu } from '../DevFailureMenu/DevFailureMenu';
import { MousePointer, Hand, ZoomIn, ZoomOut, RotateCcw, Box } from 'lucide-react';

export const Toolbar: React.FC = () => {
  const { mode, setMode, scale, setScale, resetBoard, activeScreenId } = useBoardStore();

  // Global keyboard shortcuts: V for Select, I for Interact
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      if (e.key === 'v' || e.key === 'V') {
        setMode('select');
      } else if (e.key === 'i' || e.key === 'I') {
        setMode('interact');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setMode]);

  const zoomPercent = Math.round(scale * 100);

  const handleZoomIn = () => {
    const next = Math.min(4.0, scale + 0.1);
    setScale(next);
  };

  const handleZoomOut = () => {
    const next = Math.max(0.25, scale - 0.1);
    setScale(next);
  };

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-logo">
          <Box size={20} />
          <span>Figr Inspector</span>
        </div>

        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'select' ? 'active' : ''}`}
            onClick={() => setMode('select')}
            title="Select mode (V) - Click to inspect/select elements"
          >
            <MousePointer size={14} />
            <span>Select</span>
            <kbd>V</kbd>
          </button>

          <button
            className={`mode-btn ${mode === 'interact' ? 'active' : ''}`}
            onClick={() => setMode('interact')}
            title="Interact mode (I) - Normal page interactions and navigation"
          >
            <Hand size={14} />
            <span>Interact</span>
            <kbd>I</kbd>
          </button>
        </div>
      </div>

      <div className="toolbar-center">
        {activeScreenId && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Active: <strong style={{ color: 'var(--text-main)' }}>{activeScreenId}</strong>
          </span>
        )}
      </div>

      <div className="toolbar-right">
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={handleZoomOut} title="Zoom out">
            <ZoomOut size={13} />
          </button>
          <span style={{ width: '42px', textAlign: 'center' }}>{zoomPercent}%</span>
          <button className="zoom-btn" onClick={handleZoomIn} title="Zoom in">
            <ZoomIn size={13} />
          </button>
          <button
            className="zoom-btn"
            onClick={resetBoard}
            title="Reset board view"
            style={{ marginLeft: '4px' }}
          >
            <RotateCcw size={12} />
          </button>
        </div>

        <DevFailureMenu />
      </div>
    </header>
  );
};
