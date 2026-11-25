import { useMemo, useState } from 'react';
import { BLUE_FACTORS, PINK_FACTORS, GREEN_FACTORS, WHITE_FACTORS, CHARACTERS, characterImageUrl } from './data';
import { createEmptyState } from './uql/state';
import { compileToUQL } from './uql/compile';
import { parseUQL } from './uql/parse';
import { SearchableMultiSelect } from './components/SearchableMultiSelect';
import { SparkColorSection } from './components/SparkColorSection';
import { OptionalWhiteSection } from './components/OptionalWhiteSection';
import { UqlPreview } from './components/UqlPreview';
import './App.css';

function App() {
  const [state, setState] = useState(createEmptyState);
  const [warnings, setWarnings] = useState<string[]>([]);

  const query = useMemo(() => compileToUQL(state), [state]);

  function applyUqlText(text: string) {
    const result = parseUQL(text);
    setState(result.state);
    setWarnings(result.warnings);
  }

  function updateState(updater: (s: typeof state) => typeof state) {
    setState(updater);
    setWarnings([]);
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Uma.moe UQL Builder</h1>
        <p>
          Build a UQL search query with OR support the site's Advanced Filter doesn't have. Set your filters below,
          then copy the generated query into uma.moe's inheritance database search.
        </p>
      </header>

      <main className="app-main">
        <section className="scs-root scs-char">
          <header className="scs-header">
            <h3>Characters</h3>
          </header>
          <div className="app-char-grid">
            <div>
              <label className="app-field-label">Main character</label>
              <SearchableMultiSelect
                options={CHARACTERS}
                selectedIds={state.mainCharacterIds}
                onChange={(ids) => updateState((s) => ({ ...s, mainCharacterIds: ids }))}
                placeholder="Search characters..."
                getImageUrl={(c) => characterImageUrl(c.id)}
              />
            </div>
            <div>
              <label className="app-field-label">GP character (either grandparent)</label>
              <SearchableMultiSelect
                options={CHARACTERS}
                selectedIds={state.gpCharacterIds}
                onChange={(ids) => updateState((s) => ({ ...s, gpCharacterIds: ids }))}
                placeholder="Search characters..."
                getImageUrl={(c) => characterImageUrl(c.id)}
              />
            </div>
          </div>
        </section>

        <div className="app-columns">
          <div className="app-column">
            <h2 className="app-column-heading">Lineage-wide (anywhere in Main/GP1/GP2)</h2>
            <SparkColorSection
              title="Blue sparks"
              singularLabel="Blue spark"
              accent="blue"
              factors={BLUE_FACTORS}
              groups={state.blueGroups}
              onChange={(groups) => updateState((s) => ({ ...s, blueGroups: groups }))}
            />
            <SparkColorSection
              title="Pink sparks"
              singularLabel="Pink spark"
              accent="pink"
              factors={PINK_FACTORS}
              groups={state.pinkGroups}
              onChange={(groups) => updateState((s) => ({ ...s, pinkGroups: groups }))}
            />
            <SparkColorSection
              title="Green sparks (unique skills)"
              singularLabel="Green spark"
              accent="green"
              factors={GREEN_FACTORS}
              groups={state.greenGroups}
              onChange={(groups) => updateState((s) => ({ ...s, greenGroups: groups }))}
            />
            <SparkColorSection
              title="White sparks (required)"
              singularLabel="White spark"
              accent="white"
              factors={WHITE_FACTORS}
              groups={state.whiteGroups}
              onChange={(groups) => updateState((s) => ({ ...s, whiteGroups: groups }))}
            />
            <OptionalWhiteSection
              factors={WHITE_FACTORS}
              entries={state.optionalWhite}
              onChange={(entries) => updateState((s) => ({ ...s, optionalWhite: entries }))}
            />
          </div>

          <div className="app-column">
            <h2 className="app-column-heading">Main parent only (capped at 3 stars)</h2>
            <SparkColorSection
              title="Main blue sparks"
              singularLabel="Blue spark"
              accent="blue"
              factors={BLUE_FACTORS}
              groups={state.mainBlueGroups}
              onChange={(groups) => updateState((s) => ({ ...s, mainBlueGroups: groups }))}
              maxStars={3}
            />
            <SparkColorSection
              title="Main pink sparks"
              singularLabel="Pink spark"
              accent="pink"
              factors={PINK_FACTORS}
              groups={state.mainPinkGroups}
              onChange={(groups) => updateState((s) => ({ ...s, mainPinkGroups: groups }))}
              maxStars={3}
            />
            <SparkColorSection
              title="Main green sparks (unique skills)"
              singularLabel="Green spark"
              accent="green"
              factors={GREEN_FACTORS}
              groups={state.mainGreenGroups}
              onChange={(groups) => updateState((s) => ({ ...s, mainGreenGroups: groups }))}
              maxStars={3}
            />
            <SparkColorSection
              title="Main white sparks (required)"
              singularLabel="White spark"
              accent="white"
              factors={WHITE_FACTORS}
              groups={state.mainWhiteGroups}
              onChange={(groups) => updateState((s) => ({ ...s, mainWhiteGroups: groups }))}
              maxStars={3}
            />
            <OptionalWhiteSection
              factors={WHITE_FACTORS}
              entries={state.optionalMainWhite}
              onChange={(entries) => updateState((s) => ({ ...s, optionalMainWhite: entries }))}
              title="Preferred main parent white skills (soft ranking)"
              hint="Same as Preferred white skills, but only looks at the main parent's own white sparks, not the whole lineage."
            />
          </div>
        </div>
      </main>

      <UqlPreview query={query} warnings={warnings} onApply={applyUqlText} />
    </div>
  );
}

export default App;
