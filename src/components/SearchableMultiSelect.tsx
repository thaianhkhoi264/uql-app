import { useMemo, useRef, useState, useEffect } from 'react';
import './SearchableMultiSelect.css';

export interface SelectOption {
  id: number;
  name: string;
}

interface Props<T extends SelectOption> {
  options: T[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  multiple?: boolean;
  getImageUrl?: (option: T) => string | null | undefined;
}

export function SearchableMultiSelect<T extends SelectOption>({
  options,
  selectedIds,
  onChange,
  placeholder,
  multiple = true,
  getImageUrl,
}: Props<T>) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = useMemo(
    () => selectedIds.map((id) => options.find((o) => o.id === id)).filter((o): o is T => !!o),
    [selectedIds, options],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
    return base.filter((o) => !selectedIds.includes(o.id)).slice(0, 60);
  }, [options, query, selectedIds]);

  function addOption(id: number) {
    if (multiple) {
      onChange([...selectedIds, id]);
    } else {
      onChange([id]);
      setOpen(false);
    }
    setQuery('');
  }

  function removeOption(id: number) {
    onChange(selectedIds.filter((existing) => existing !== id));
  }

  return (
    <div className="sms-root" ref={rootRef}>
      <div className="sms-chips" onClick={() => setOpen(true)}>
        {selected.map((option) => {
          const imageUrl = getImageUrl?.(option);
          return (
            <span key={option.id} className="sms-chip">
              {imageUrl && <img src={imageUrl} alt="" className="sms-chip-image" loading="lazy" />}
              {option.name}
              <button
                type="button"
                className="sms-chip-remove"
                onClick={(event) => {
                  event.stopPropagation();
                  removeOption(option.id);
                }}
                aria-label={`Remove ${option.name}`}
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          className="sms-input"
          value={query}
          placeholder={selected.length === 0 ? placeholder : ''}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="sms-dropdown">
          {filtered.map((option) => {
            const imageUrl = getImageUrl?.(option);
            return (
              <button type="button" key={option.id} className="sms-option" onClick={() => addOption(option.id)}>
                {imageUrl && <img src={imageUrl} alt="" className="sms-option-image" loading="lazy" />}
                {option.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
