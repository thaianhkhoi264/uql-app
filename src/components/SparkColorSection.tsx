import type { Factor } from '../data';
import { factorIconUrl } from '../data';
import type { SparkGroup } from '../uql/state';
import { MAX_PICKS_PER_GROUP, duplicateSparkGroup, emptySparkGroup, emptySparkPick, flipSparkGroup } from '../uql/state';
import { ANY_FACTOR_ID, ANY_FACTOR_LABEL, CUSTOM_FACTOR_ID, CUSTOM_FACTOR_LABEL } from '../uql/sparkFields';
import { DualRangeSlider } from './DualRangeSlider';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import './SparkColorSection.css';

interface Props {
  title: string;
  singularLabel: string;
  accent: 'blue' | 'pink' | 'green' | 'white';
  factors: Factor[];
  groups: SparkGroup[];
  onChange: (groups: SparkGroup[]) => void;
  maxStars?: number;
}

export function SparkColorSection({ title, singularLabel, accent, factors, groups, onChange, maxStars = 9 }: Props) {
  function addGroup() {
    onChange([...groups, emptySparkGroup()]);
  }

  function removeGroup(groupId: string) {
    onChange(groups.filter((g) => g.id !== groupId));
  }

  function duplicateGroup(groupId: string) {
    const index = groups.findIndex((g) => g.id === groupId);
    if (index === -1) return;
    const copy = duplicateSparkGroup(groups[index]);
    onChange([...groups.slice(0, index + 1), copy, ...groups.slice(index + 1)]);
  }

  function flipGroup(groupId: string) {
    onChange(groups.map((g) => (g.id === groupId ? flipSparkGroup(g) : g)));
  }

  function addPick(groupId: string) {
    onChange(
      groups.map((g) =>
        g.id === groupId && g.picks.length < MAX_PICKS_PER_GROUP
          ? { ...g, picks: [...g.picks, emptySparkPick(factors[0]?.id ?? 0, maxStars)] }
          : g,
      ),
    );
  }

  function removePick(groupId: string, pickId: string) {
    onChange(groups.map((g) => (g.id === groupId ? { ...g, picks: g.picks.filter((p) => p.id !== pickId) } : g)));
  }

  function updatePick(
    groupId: string,
    pickId: string,
    patch: Partial<{ factorId: number; customFactorIds: number[]; min: number; max: number }>,
  ) {
    onChange(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, picks: g.picks.map((p) => (p.id === pickId ? { ...p, ...patch } : p)) }
          : g,
      ),
    );
  }

  return (
    <section className={`scs-root scs-${accent}`}>
      <header className="scs-header">
        <h3>{title}</h3>
        <span className="scs-hint">
          Sparks within a group are required together (AND). Multiple groups are alternatives (OR).
        </span>
      </header>

      {groups.length === 0 && <p className="scs-empty">No {title.toLowerCase()} filters — click below to add one.</p>}

      {groups.map((group, groupIndex) => (
        <div key={group.id} className="scs-group">
          {groupIndex > 0 && <div className="scs-or-divider">OR</div>}
          <div className="scs-group-body">
            {group.picks.map((pick) => (
              <div key={pick.id} className="scs-pick">
                <div className="scs-pick-row">
                  <select
                    className="scs-select"
                    value={pick.factorId}
                    onChange={(event) => updatePick(group.id, pick.id, { factorId: Number(event.target.value) })}
                  >
                    <option value={ANY_FACTOR_ID}>{ANY_FACTOR_LABEL}</option>
                    <option value={CUSTOM_FACTOR_ID}>{CUSTOM_FACTOR_LABEL}</option>
                    {factors.map((factor) => (
                      <option key={factor.id} value={factor.id}>
                        {factor.name}
                      </option>
                    ))}
                  </select>
                  <DualRangeSlider
                    min={1}
                    max={maxStars}
                    lo={pick.min}
                    hi={pick.max}
                    onChange={(lo, hi) => updatePick(group.id, pick.id, { min: lo, max: hi })}
                  />
                  <button type="button" className="scs-remove" onClick={() => removePick(group.id, pick.id)} aria-label="Remove spark">
                    ×
                  </button>
                </div>
                {pick.factorId === CUSTOM_FACTOR_ID && (
                  <div className="scs-pick-custom">
                    <SearchableMultiSelect
                      options={factors}
                      selectedIds={pick.customFactorIds}
                      onChange={(ids) => updatePick(group.id, pick.id, { customFactorIds: ids })}
                      getImageUrl={factorIconUrl}
                      placeholder="Choose which sparks qualify..."
                    />
                  </div>
                )}
              </div>
            ))}
            {group.picks.length < MAX_PICKS_PER_GROUP && (
              <button type="button" className="scs-add-pick" onClick={() => addPick(group.id)}>
                + Add {singularLabel}
              </button>
            )}
          </div>
          <div className="scs-group-actions">
            <button type="button" className="scs-group-action" onClick={() => duplicateGroup(group.id)}>
              Duplicate
            </button>
            {group.picks.length === 2 && (
              <button type="button" className="scs-group-action" onClick={() => flipGroup(group.id)}>
                Flip
              </button>
            )}
            <button type="button" className="scs-remove-group" onClick={() => removeGroup(group.id)}>
              Remove this group
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="scs-add-group" onClick={addGroup}>
        + Add {groups.length > 0 ? 'OR alternative' : `${title.toLowerCase()} group`}
      </button>
    </section>
  );
}
