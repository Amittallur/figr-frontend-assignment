import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ScreenItem } from '../../types/screens';
import { fetchScreens } from '../../services/api';
import { useBoardStore } from '../../store/boardStore';
import { useSelectionStore } from '../../store/selectionStore';
import { useErrorStore } from '../../store/errorStore';
import { PreviewCard } from '../Preview/PreviewCard';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const Board: React.FC = () => {
  const [screens, setScreens] = useState<ScreenItem[]>([]);

  const { panX, panY, scale, updatePan, zoomAt } = useBoardStore();
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const clearHover = useSelectionStore((s) => s.clearHover);

  const boardError = useErrorStore((s) => s.boardError);
  const devFailScreens = useErrorStore((s) => s.devFailScreens);

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const didMoveRef = useRef(false);

  // Fetch screens on mount or retry
  const loadScreens = useCallback(async () => {
    useErrorStore.getState().setBoardError(null);

    try {
      if (devFailScreens) {
        throw new Error('Screens API failure (Simulated)');
      }
      const data = await fetchScreens();
      setScreens(data);
    } catch (err: any) {
      useErrorStore
        .getState()
        .handleFailure('board', null, undefined, err, 'screens_load');
    }
  }, [devFailScreens]);

  useEffect(() => {
    loadScreens();
  }, [loadScreens]);

  const handleRetryScreens = () => {
    useErrorStore
      .getState()
      .retryRegion('board', null, undefined, 'screens_load');
    loadScreens();
  };

  // Keyboard shortcut: Escape clears selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);

  // Window pointerleave clears hover
  useEffect(() => {
    const handleMouseLeave = () => clearHover();
    window.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) {
        clearHover();
      }
    });
    return () => window.removeEventListener('mouseout', handleMouseLeave);
  }, [clearHover]);

  // Wheel handling over board background:
  // - Ctrl/Cmd + wheel: zoom
  // - Normal wheel: pan
  const handleWheel = (e: React.WheelEvent) => {
    // Only handle if directly targeting viewport or empty canvas
    const target = e.target as HTMLElement;
    const isOverBoard =
      target === viewportRef.current ||
      target === canvasRef.current ||
      target.classList.contains('screens-grid');

    if (!isOverBoard) return;

    e.preventDefault();
    clearHover();

    if (e.ctrlKey || e.metaKey) {
      // Zoom centered on pointer
      zoomAt(e.deltaY, e.clientX, e.clientY);
    } else {
      // Pan
      updatePan(-e.deltaX, -e.deltaY);
    }
  };

  // Dragging empty board space to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isOverBoard =
      target === viewportRef.current ||
      target === canvasRef.current ||
      target.classList.contains('screens-grid');

    if (!isOverBoard || e.button !== 0) return;

    isPanningRef.current = true;
    didMoveRef.current = false;
    panStartRef.current = { x: e.clientX, y: e.clientY };
    clearHover();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isPanningRef.current) return;
      const dx = moveEvent.clientX - panStartRef.current.x;
      const dy = moveEvent.clientY - panStartRef.current.y;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didMoveRef.current = true;
      }

      updatePan(dx, dy);
      panStartRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
    };

    const handleMouseUp = () => {
      isPanningRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      // If user clicked empty board space without dragging: clear selection
      if (!didMoveRef.current) {
        clearSelection();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (boardError) {
    return (
      <div className="board-viewport" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            padding: '32px 48px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            textAlign: 'center',
            maxWidth: '480px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
        >
          <AlertTriangle size={36} color="#ef4444" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
            Board Loading Error
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            {boardError}
          </p>
          <button className="btn-retry" onClick={handleRetryScreens}>
            <RefreshCw size={14} /> Retry Loading Screens
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className={`board-viewport ${isPanningRef.current ? 'panning' : ''}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
    >
      <div
        ref={canvasRef}
        className="board-canvas"
        style={{
          transform: `matrix(${scale}, 0, 0, ${scale}, ${panX}, ${panY})`,
        }}
      >
        <div className="screens-grid">
          {screens.map((screen) => (
            <PreviewCard key={screen.id} screen={screen} />
          ))}
        </div>
      </div>
    </div>
  );
};
