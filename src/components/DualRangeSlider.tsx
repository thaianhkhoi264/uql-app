import './DualRangeSlider.css';

interface Props {
  min: number;
  max: number;
  lo: number;
  hi: number;
  onChange: (lo: number, hi: number) => void;
}

export function DualRangeSlider({ min, max, lo, hi, onChange }: Props) {
  const range = max - min;
  const loPct = range === 0 ? 0 : ((lo - min) / range) * 100;
  const hiPct = range === 0 ? 100 : ((hi - min) / range) * 100;

  function handleLoChange(value: number) {
    onChange(Math.min(value, hi), hi);
  }

  function handleHiChange(value: number) {
    onChange(lo, Math.max(value, lo));
  }

  return (
    <div className="drs-root">
      <div className="drs-track">
        <div className="drs-fill" style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={lo}
        onChange={(event) => handleLoChange(Number(event.target.value))}
        className="drs-input drs-input-lo"
      />
      <input
        type="range"
        min={min}
        max={max}
        value={hi}
        onChange={(event) => handleHiChange(Number(event.target.value))}
        className="drs-input drs-input-hi"
      />
      <div className="drs-labels">
        {Array.from({ length: range + 1 }, (_, index) => min + index).map((value) => (
          <span key={value} className={value >= lo && value <= hi ? 'drs-label drs-label-active' : 'drs-label'}>
            {value}★
          </span>
        ))}
      </div>
    </div>
  );
}
