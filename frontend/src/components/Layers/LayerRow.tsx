import React, { useRef, useEffect } from 'react';
import { TreeNode } from '../../types/layers';
import { ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';

interface Props {
  node: TreeNode;
  isExpanded: boolean;
  isLoading: boolean;
  isFailed: boolean;
  isSelected: boolean;
  isHovered: boolean;
  depth: number;
  onSelect: (node: TreeNode, isShift: boolean) => void;
  onHover: (node: TreeNode | null) => void;
  onToggleExpand: (node: TreeNode) => void;
  onRetry: (node: TreeNode) => void;
}

export const LayerRow: React.FC<Props> = ({
  node,
  isExpanded,
  isLoading,
  isFailed,
  isSelected,
  isHovered,
  depth,
  onSelect,
  onHover,
  onToggleExpand,
  onRetry,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  // If selected, ensure row is visible inside layers panel without scrolling host
  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  const handleRowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node, e.shiftKey);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(node);
  };

  const handleRetryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRetry(node);
  };

  return (
    <div
      ref={rowRef}
      className={`layer-row ${isSelected ? 'selected' : ''} ${
        isHovered ? 'hover-highlight' : ''
      }`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleRowClick}
      onMouseEnter={() => onHover(node)}
      onMouseLeave={() => onHover(null)}
      data-node-id={node.id}
    >
      {node.hasChildren ? (
        <span className="layer-row-chevron" onClick={handleChevronClick}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      ) : (
        <span style={{ width: '18px', height: '18px', flexShrink: 0 }} />
      )}

      <span className="layer-row-name" title={node.name}>
        {node.name}
      </span>

      {node.dataKey && (
        <span className="layer-row-key-badge" title={`data-key: ${node.dataKey}`}>
          {node.dataKey}
        </span>
      )}

      {isLoading && <span className="layer-row-loading">Loading...</span>}

      {isFailed && (
        <span className="layer-row-failed">
          <span>Couldn't load</span>
          <button className="layer-row-retry-btn" onClick={handleRetryClick}>
            <RefreshCw size={10} /> Retry
          </button>
        </span>
      )}
    </div>
  );
};
