import React from 'react';
import { useBoardStore } from '../../store/boardStore';
import { useSelectionStore } from '../../store/selectionStore';
import { ElementRect } from '../../types/element';

interface Props {
  screenId: string;
}

export const PreviewOverlay: React.FC<Props> = ({ screenId }) => {
  const mode = useBoardStore((s) => s.mode);
  const scale = useBoardStore((s) => s.scale);
  const selectedItems = useSelectionStore((s) => s.selectedItems);
  const hoveredItem = useSelectionStore((s) => s.hoveredItem);
  const geometryCache = useSelectionStore((s) => s.geometryCache);

  // In interact mode, overlays disappear
  if (mode !== 'select') {
    return null;
  }

  // Visual outline thicknesses scaled to stay exactly 1px / 2px on screen
  const hoverBorderWidth = Math.max(1, 1 / scale);
  const selectionBorderWidth = Math.max(1, 2 / scale);
  const labelScale = 1 / scale;

  // Selected items for this screen
  const currentScreenSelections = selectedItems.filter(
    (it) => it.screenId === screenId && !it.isMissing
  );

  // Is hovered element in this screen?
  const isHoveredHere =
    hoveredItem &&
    hoveredItem.screenId === screenId &&
    hoveredItem.bounds &&
    hoveredItem.bounds.width > 0 &&
    hoveredItem.bounds.height > 0;

  // Helper to check if rect is inside visible preview viewport (1280x800)
  const isRectVisible = (r: ElementRect) => {
    return r.x + r.width > 0 && r.x < 1280 && r.y + r.height > 0 && r.y < 800;
  };

  return (
    <div className="preview-overlay">
      {/* Selection Outlines and Labels */}
      {currentScreenSelections.map((sel) => {
        const bounds =
          geometryCache[`${screenId}::${sel.elementId}`];
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
        if (!isRectVisible(bounds)) return null;

        // Label above if room (>= 24px), otherwise below
        const hasRoomAbove = bounds.y >= 24 / scale;
        const labelStyle: React.CSSProperties = {
          position: 'absolute',
          transform: `scale(${labelScale})`,
          transformOrigin: hasRoomAbove ? 'bottom left' : 'top left',
          left: `${bounds.x}px`,
          top: hasRoomAbove ? `${bounds.y - 20 * labelScale}px` : `${bounds.y + bounds.height + 2}px`,
        };

        return (
          <React.Fragment key={sel.elementId}>
            <div
              className="overlay-selection-box"
              style={{
                left: `${bounds.x}px`,
                top: `${bounds.y}px`,
                width: `${bounds.width}px`,
                height: `${bounds.height}px`,
                borderWidth: `${selectionBorderWidth}px`,
              }}
            />
            <div className="overlay-label" style={labelStyle}>
              {sel.name}
            </div>
          </React.Fragment>
        );
      })}

      {/* Hover Outline and Label */}
      {isHoveredHere && hoveredItem && isRectVisible(hoveredItem.bounds) && (
        <React.Fragment>
          <div
            className="overlay-hover-box"
            style={{
              left: `${hoveredItem.bounds.x}px`,
              top: `${hoveredItem.bounds.y}px`,
              width: `${hoveredItem.bounds.width}px`,
              height: `${hoveredItem.bounds.height}px`,
              borderWidth: `${hoverBorderWidth}px`,
            }}
          />
          <div
            className="overlay-label hover-label"
            style={{
              position: 'absolute',
              transform: `scale(${labelScale})`,
              transformOrigin: hoveredItem.bounds.y >= 24 / scale ? 'bottom left' : 'top left',
              left: `${hoveredItem.bounds.x}px`,
              top:
                hoveredItem.bounds.y >= 24 / scale
                  ? `${hoveredItem.bounds.y - 20 * labelScale}px`
                  : `${hoveredItem.bounds.y + hoveredItem.bounds.height + 2}px`,
            }}
          >
            {hoveredItem.name}
          </div>
        </React.Fragment>
      )}
    </div>
  );
};
