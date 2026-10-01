import React from 'react';
import { LiveInfo } from '../../types/element';
import { MultiLiveProperty } from '../../store/inspectorStore';

interface SingleProps {
  isMulti: false;
  live: LiveInfo;
}

interface MultiProps {
  isMulti: true;
  multiCount: number;
  multiLive: Record<string, MultiLiveProperty>;
}

type Props = SingleProps | MultiProps;

export const LiveSection: React.FC<Props> = (props) => {
  if (props.isMulti) {
    const { multiCount, multiLive } = props;

    const renderMultiRow = (label: string, field: string) => {
      const prop = multiLive[field];
      const isMixed = !prop || prop.isMixed;
      return (
        <React.Fragment key={field}>
          <div className="inspector-label">{label}</div>
          <div className={`inspector-value ${isMixed ? 'mixed' : ''}`}>
            {isMixed ? 'Mixed' : String(prop.value)}
          </div>
        </React.Fragment>
      );
    };

    return (
      <div className="inspector-section">
        <div className="inspector-section-title">
          <span>Live · {multiCount} elements selected</span>
        </div>

        <div className="inspector-grid">
          {renderMultiRow('Tag', 'tag')}
          {renderMultiRow('ID', 'id')}
          {renderMultiRow('Classes', 'classes')}
          {renderMultiRow('Dimensions', 'dimensions')}
          {renderMultiRow('Position', 'position')}
          {renderMultiRow('Text', 'text')}
          {renderMultiRow('Color', 'textColor')}
          {renderMultiRow('Background', 'backgroundColor')}
          {renderMultiRow('Font Family', 'fontFamily')}
          {renderMultiRow('Font Size', 'fontSize')}
          {renderMultiRow('Font Weight', 'fontWeight')}
        </div>
      </div>
    );
  }

  const { live } = props;

  return (
    <div className="inspector-section">
      <div className="inspector-section-title">
        <span>Live Properties</span>
      </div>

      <div className="inspector-grid">
        <div className="inspector-label">Name</div>
        <div className="inspector-value">{live.name}</div>

        <div className="inspector-label">Tag</div>
        <div className="inspector-value" style={{ color: 'var(--text-code)' }}>
          &lt;{live.tag}&gt;
        </div>

        {live.id && (
          <React.Fragment>
            <div className="inspector-label">ID</div>
            <div className="inspector-value">#{live.id}</div>
          </React.Fragment>
        )}

        {live.classes && live.classes.length > 0 && (
          <React.Fragment>
            <div className="inspector-label">Classes</div>
            <div className="inspector-value">.{live.classes.join(' .')}</div>
          </React.Fragment>
        )}

        <div className="inspector-label">Dimensions</div>
        <div className="inspector-value">
          {live.width} × {live.height} px
        </div>

        <div className="inspector-label">Position</div>
        <div className="inspector-value">
          X: {live.pageX}px, Y: {live.pageY}px
        </div>

        {live.text && (
          <React.Fragment>
            <div className="inspector-label">Text</div>
            <div
              className="inspector-value"
              style={{
                maxHeight: '60px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
              }}
            >
              "{live.text}"
            </div>
          </React.Fragment>
        )}

        <div className="inspector-label">Color</div>
        <div className="inspector-value">
          <span
            className="color-preview"
            style={{ backgroundColor: live.textColor }}
          />
          {live.textColor}
        </div>

        <div className="inspector-label">Background</div>
        <div className="inspector-value">
          <span
            className="color-preview"
            style={{ backgroundColor: live.backgroundColor }}
          />
          {live.backgroundColor}
        </div>

        <div className="inspector-label">Font Family</div>
        <div className="inspector-value" title={live.fontFamily}>
          {live.fontFamily.split(',')[0]}
        </div>

        <div className="inspector-label">Font Size</div>
        <div className="inspector-value">{live.fontSize}</div>

        <div className="inspector-label">Font Weight</div>
        <div className="inspector-value">{live.fontWeight}</div>
      </div>
    </div>
  );
};
