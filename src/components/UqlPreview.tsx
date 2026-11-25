import { useEffect, useState } from 'react';
import './UqlPreview.css';

interface Props {
  query: string;
  warnings: string[];
  onApply: (text: string) => void;
}

export function UqlPreview({ query, warnings, onApply }: Props) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(query);
  const [dirty, setDirty] = useState(false);

  // Keep the box in sync with filter changes made above, but don't clobber
  // text the user is actively editing here.
  useEffect(() => {
    if (!dirty) setDraft(query);
  }, [query, dirty]);

  async function handleCopy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be unavailable (e.g. non-HTTPS local file); the
      // textarea below can still be selected and copied manually.
    }
  }

  function applyDraft() {
    onApply(draft);
    setDirty(false);
  }

  return (
    <div className="uql-preview">
      <div className="uql-preview-header">
        <h2>UQL</h2>
        <div className="uql-preview-actions">
          {dirty && (
            <button type="button" className="uql-apply-btn" onClick={applyDraft}>
              Apply to filters above
            </button>
          )}
          <button type="button" className="uql-copy-btn" onClick={handleCopy} disabled={!draft}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <textarea
        className="uql-preview-text"
        value={draft}
        placeholder="// Add filters above, or paste a UQL query here"
        rows={5}
        onChange={(event) => {
          setDraft(event.target.value);
          setDirty(true);
        }}
        onBlur={() => {
          if (dirty) applyDraft();
        }}
      />
      {warnings.length > 0 && (
        <ul className="uql-preview-warnings">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <p className="uql-preview-hint">
        Paste this into the UQL box on uma.moe's inheritance database search, or paste a query here to load it into
        the filters above.
      </p>
    </div>
  );
}
