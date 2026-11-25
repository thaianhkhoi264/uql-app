import type { Factor } from '../data';
import { factorIconUrl } from '../data';
import type { OptionalWhiteEntry } from '../uql/state';
import { emptyOptionalWhite } from '../uql/state';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import './SparkColorSection.css';

interface Props {
  factors: Factor[];
  entries: OptionalWhiteEntry[];
  onChange: (entries: OptionalWhiteEntry[]) => void;
  title?: string;
  hint?: string;
}

export function OptionalWhiteSection({
  factors,
  entries,
  onChange,
  title = 'Preferred white skills (soft ranking)',
  hint = "Doesn't exclude results — just ranks rows with these skills higher. Priority 0 is checked first; higher numbers only break ties.",
}: Props) {
  function addEntry() {
    onChange([...entries, emptyOptionalWhite(entries.length)]);
  }

  function removeEntry(id: string) {
    onChange(entries.filter((e) => e.id !== id));
  }

  function updateEntry(id: string, patch: Partial<OptionalWhiteEntry>) {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  return (
    <section className="scs-root scs-white">
      <header className="scs-header">
        <h3>{title}</h3>
        <span className="scs-hint">{hint}</span>
      </header>

      {entries.length === 0 && <p className="scs-empty">No preferred skills — click below to add a priority group.</p>}

      {entries.map((entry) => (
        <div key={entry.id} className="scs-group">
          <div className="scs-group-body">
            <div style={{ marginBottom: 8 }}>
              <SearchableMultiSelect
                options={factors}
                selectedIds={entry.factorIds}
                onChange={(ids) => updateEntry(entry.id, { factorIds: ids })}
                getImageUrl={factorIconUrl}
                placeholder="Search white skills..."
              />
            </div>
            <label className="ows-priority-label">
              Priority group
              <input
                type="number"
                min={0}
                className="ows-priority-input"
                value={entry.priority}
                onChange={(event) => updateEntry(entry.id, { priority: Number(event.target.value) })}
              />
            </label>
          </div>
          <button type="button" className="scs-remove-group" onClick={() => removeEntry(entry.id)}>
            Remove this priority group
          </button>
        </div>
      ))}

      <button type="button" className="scs-add-group" onClick={addEntry}>
        + Add priority group
      </button>
    </section>
  );
}
