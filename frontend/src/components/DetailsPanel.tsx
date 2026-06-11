import type { AlertRecord, Asset, EventRecord, Flow } from '@soc/telemetry-shared';
import { severityTone } from '../lib/telemetry';

interface DetailsPanelProps {
  selectedAsset: Asset | null;
  relatedFlows: Flow[];
  relatedEvents: EventRecord[];
  relatedAlerts: AlertRecord[];
  totalCount: number;
}

export function DetailsPanel({ selectedAsset, relatedFlows, relatedEvents, relatedAlerts, totalCount }: DetailsPanelProps) {
  if (!selectedAsset) {
    return (
      <div className="empty-state">
        Select a node in the communication graph to inspect asset context, associated flows, and related detections.
        <div className="detail-grid" style={{ marginTop: 16 }}>
          <div className="detail-card">
            <span>Visible records</span>
            <strong>{totalCount}</strong>
          </div>
          <div className="detail-card">
            <span>Related alerts</span>
            <strong>{relatedAlerts.length}</strong>
          </div>
        </div>
      </div>
    );
  }

  const rawPayload = {
    asset: selectedAsset,
    relatedFlows: relatedFlows.slice(0, 5),
    relatedEvents: relatedEvents.slice(0, 3),
    relatedAlerts: relatedAlerts.slice(0, 3)
  };

  return (
    <div>
      <div className="detail-chip-row">
        <span className="detail-chip">{selectedAsset.ip}</span>
        {selectedAsset.hostname && <span className="detail-chip">{selectedAsset.hostname}</span>}
        {selectedAsset.country && <span className="detail-chip">{selectedAsset.country}</span>}
        {selectedAsset.username && <span className="detail-chip">{selectedAsset.username}</span>}
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <span>Hostname</span>
          <strong>{selectedAsset.hostname ?? 'Unknown'}</strong>
        </div>
        <div className="detail-card">
          <span>Communication volume</span>
          <strong>{selectedAsset.communicationVolume.toLocaleString()}</strong>
        </div>
        <div className="detail-card">
          <span>Sources</span>
          <strong>{selectedAsset.sourceVendor.join(', ')}</strong>
        </div>
        <div className="detail-card">
          <span>MAC</span>
          <strong>{selectedAsset.mac ?? 'Unknown'}</strong>
        </div>
      </div>

      <div className="details-list" style={{ marginBottom: 12 }}>
        <div className="detail-card">
          <span>Related flows</span>
          <strong>{relatedFlows.length}</strong>
        </div>
        <div className="detail-card">
          <span>Related events</span>
          <strong>{relatedEvents.length}</strong>
        </div>
        <div className="detail-card">
          <span>Related alerts</span>
          <strong>{relatedAlerts.length}</strong>
        </div>
        {relatedAlerts.slice(0, 3).map((alert) => (
          <div className="detail-card" key={alert.id}>
            <span style={{ color: severityTone(alert.severity) }}>Alert</span>
            <strong>{alert.alert_name}</strong>
          </div>
        ))}
      </div>

      <pre className="raw-json">{JSON.stringify(rawPayload, null, 2)}</pre>
    </div>
  );
}
