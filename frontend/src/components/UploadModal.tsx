import { useRef, useState } from 'react';

const VENDORS = [
  { key: 'qradar',     label: 'IBM QRadar'      },
  { key: 'sna',        label: 'Cisco SNA'        },
  { key: 'arista',     label: 'Arista NDR'       },
  { key: 'cisco_ise',  label: 'Cisco ISE'        },
  { key: 'cisco_dnac', label: 'Cisco DNA Center' },
  { key: 'cisco_apic', label: 'Cisco APIC'       },
] as const;

type VendorKey = typeof VENDORS[number]['key'];
const MAX_OTHER = 5;

interface UploadModalProps {
  onClose: () => void;
  onPayloadLoaded: (payload: unknown) => void;
}

export function UploadModal({ onClose, onPayloadLoaded }: UploadModalProps) {
  const [files, setFiles] = useState<Partial<Record<VendorKey, File>>>({});
  const [otherFiles, setOtherFiles] = useState<(File | null)[]>([null]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Partial<Record<VendorKey, HTMLInputElement | null>>>({});
  const otherRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFile = (vendor: VendorKey, file: File | null) => {
    setFiles((prev) => {
      if (!file) { const next = { ...prev }; delete next[vendor]; return next; }
      return { ...prev, [vendor]: file };
    });
    setError(null);
  };

  const handleOtherFile = (index: number, file: File | null) => {
    setOtherFiles((prev) => { const next = [...prev]; next[index] = file; return next; });
    setError(null);
  };

  const addOtherSlot = () => {
    if (otherFiles.length < MAX_OTHER) setOtherFiles((prev) => [...prev, null]);
  };

  const removeOtherSlot = (index: number) => {
    setOtherFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [null] : next;
    });
  };

  const handleDrop = (vendor: VendorKey, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(vendor, file);
  };

  const handleOtherDrop = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleOtherFile(index, file);
  };

  const handleSubmit = async () => {
    const validOther = otherFiles.filter(Boolean).length;
    if (Object.keys(files).length === 0 && validOther === 0) {
      setError('Select at least one CSV file to upload.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const toBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

      const entries: [string, string][] = await Promise.all(
        Object.entries(files).map(async ([vendor, file]) => [vendor, await toBase64(file as File)] as [string, string])
      );

      let otherIndex = 0;
      for (const file of otherFiles) {
        if (file) {
          entries.push([`other_${otherIndex}`, await toBase64(file)]);
          otherIndex++;
        }
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(entries)),
      });
      const data = await res.json() as { ok: boolean; snapshot?: unknown; message?: string };
      if (!data.ok || !data.snapshot) throw new Error(data.message ?? 'Upload failed');
      onPayloadLoaded(data.snapshot);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  };

  const fileCount = Object.keys(files).length + otherFiles.filter(Boolean).length;

  return (
    <div className="upload-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="upload-modal">

        <div className="upload-modal-header">
          <span className="upload-modal-title">Upload Custom CSV Data</span>
          <button className="upload-modal-close" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="upload-modal-body">
          <p className="upload-modal-desc">
            Upload any combination of vendor CSVs — you don't need all 6. Any vendor you skip keeps using the built-in sample data.
          </p>

          <div className="upload-vendor-grid">
            {VENDORS.map(({ key, label }) => {
              const file = files[key];
              return (
                <div
                  key={key}
                  className={`upload-vendor-slot ${file ? 'has-file' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(key, e)}
                  onClick={() => inputRefs.current[key]?.click()}
                >
                  <input
                    ref={(el) => { inputRefs.current[key] = el; }}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFile(key, e.target.files?.[0] ?? null)}
                  />
                  <div className="upload-slot-icon">{file ? '✓' : '+'}</div>
                  <div className="upload-slot-label">{label}</div>
                  {file && (
                    <button
                      className="upload-slot-remove"
                      title="Remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFile(key, null);
                        if (inputRefs.current[key]) inputRefs.current[key]!.value = '';
                      }}
                    >✕</button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="upload-other-section">
            <div className="upload-other-header">
              <span className="upload-other-title">Other Logs</span>
              {otherFiles.length < MAX_OTHER && (
                <button className="upload-other-add" onClick={addOtherSlot}>+ Add Another</button>
              )}
            </div>
            <div className="upload-other-slots">
              {otherFiles.map((file, index) => (
                <div
                  key={index}
                  className={`upload-vendor-slot upload-other-slot ${file ? 'has-file' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleOtherDrop(index, e)}
                  onClick={() => otherRefs.current[index]?.click()}
                >
                  <input
                    ref={(el) => { otherRefs.current[index] = el; }}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={(e) => handleOtherFile(index, e.target.files?.[0] ?? null)}
                  />
                  <div className="upload-slot-icon">{file ? '✓' : '+'}</div>
                  <div className="upload-slot-label">
                    {otherFiles.length > 1 ? `Other Logs ${index + 1}` : 'Other Logs'}
                  </div>
                  {(file || index > 0) && (
                    <button
                      className="upload-slot-remove"
                      title={file ? 'Remove file' : 'Remove slot'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (file) {
                          handleOtherFile(index, null);
                          if (otherRefs.current[index]) otherRefs.current[index]!.value = '';
                        } else {
                          removeOtherSlot(index);
                        }
                      }}
                    >✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <div className="upload-modal-error">{error}</div>}
        </div>

        <div className="upload-modal-footer">
          <span className="upload-modal-count">
            {fileCount === 0
              ? 'No files selected — pick at least one'
              : `${fileCount} file${fileCount > 1 ? 's' : ''} selected`}
          </span>
          <div className="upload-modal-actions">
            <button className="upload-btn-cancel" onClick={onClose} disabled={uploading}>Cancel</button>
            <button
              className="upload-btn-submit"
              onClick={handleSubmit}
              disabled={uploading || fileCount === 0}
            >
              {uploading ? 'Processing…' : `Upload & Load${fileCount > 0 ? ` (${fileCount})` : ''}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
