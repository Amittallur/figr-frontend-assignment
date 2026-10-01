import React, { useEffect, useCallback } from 'react';
import { useInspectorStore } from '../../store/inspectorStore';
import { useErrorStore } from '../../store/errorStore';
import { fetchElementDetails } from '../../services/api';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  screenId: string;
  elementKey?: string;
  selectionVersion: number;
}

export const DetailsSection: React.FC<Props> = ({
  screenId,
  elementKey,
  selectionVersion,
}) => {
  const {
    details,
    loadingDetails,
    detailsError,
    details404,
    setDetails,
    setLoadingDetails,
    setDetailsError,
    setDetails404,
  } = useInspectorStore();

  const devFailDetails500 = useErrorStore((s) => s.devFailDetails500);
  const devFailDetailsMalformed = useErrorStore((s) => s.devFailDetailsMalformed);

  const loadDetails = useCallback(
    async (signal?: AbortSignal) => {
      if (!elementKey) {
        setDetails(null, selectionVersion);
        return;
      }

      setLoadingDetails(true, selectionVersion);
      setDetailsError(null, selectionVersion);
      setDetails404(false, selectionVersion);

      try {
        if (devFailDetails500) {
          throw new Error('Internal Server Error 500 (Simulated)');
        }
        if (devFailDetailsMalformed) {
          throw new Error('Details API returned malformed JSON: {"component": "Butt (Simulated)');
        }

        const data = await fetchElementDetails(elementKey, signal);

        if (signal?.aborted) return;

        if (data === null) {
          // 404 is valid - not an error
          setDetails404(true, selectionVersion);
        } else {
          setDetails(data, selectionVersion);
        }
      } catch (err: any) {
        if (signal?.aborted) return;

        setDetailsError(err.message || 'Details failed to load', selectionVersion);
        useErrorStore
          .getState()
          .handleFailure('details', screenId, elementKey, err, `details_${elementKey}`);
      }
    },
    [
      elementKey,
      selectionVersion,
      devFailDetails500,
      devFailDetailsMalformed,
      screenId,
      setDetails,
      setLoadingDetails,
      setDetailsError,
      setDetails404,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadDetails(controller.signal);
    return () => controller.abort();
  }, [loadDetails]);

  const handleRetry = () => {
    useErrorStore
      .getState()
      .retryRegion('details', screenId, elementKey, `details_${elementKey}`);
    loadDetails();
  };

  return (
    <div className="inspector-section">
      <div className="inspector-section-title">
        <span>Component Details</span>
      </div>

      {!elementKey ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No details (no data-key)
        </div>
      ) : loadingDetails ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Loading details...
        </div>
      ) : detailsError ? (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '12px',
            borderRadius: '6px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#fca5a5',
              marginBottom: '6px',
            }}
          >
            <AlertTriangle size={14} />
            <span>Details loading failed</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            {detailsError}
          </div>
          <button className="btn-retry" onClick={handleRetry} style={{ padding: '4px 10px', fontSize: '11px' }}>
            <RefreshCw size={11} /> Retry Details
          </button>
        </div>
      ) : details404 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No details for this element
        </div>
      ) : details ? (
        <div className="inspector-grid">
          <div className="inspector-label">Component</div>
          <div className="inspector-value" style={{ fontWeight: 600, color: '#fff' }}>
            {details.component}
          </div>

          <div className="inspector-label">Status</div>
          <div className="inspector-value">
            <span className={`badge-status ${details.status}`}>
              {details.status}
            </span>
          </div>

          <div className="inspector-label">Owner</div>
          <div className="inspector-value">{details.owner}</div>

          <div className="inspector-label">Description</div>
          <div
            className="inspector-value"
            style={{
              fontFamily: 'inherit',
              lineHeight: 1.4,
              color: 'var(--text-secondary)',
            }}
          >
            {details.description}
          </div>
        </div>
      ) : null}
    </div>
  );
};
