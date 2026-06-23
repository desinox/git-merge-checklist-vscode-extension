import { Search, Ban, GitBranch } from 'lucide-react';
import type { BranchRef } from '../../src/git/types';
import type { FilterState } from '../../src/messages';

interface Props {
  sources: string[];
  refs: BranchRef[];
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onReferenceBranchChange: (ref: string) => void;
}

function sourceLabel(source: string): string {
  return source === 'local' ? 'Local branches' : source;
}

export function FilterBar({
  sources,
  refs,
  filters,
  onChange,
  onReferenceBranchChange
}: Props) {
  const toggleSource = (source: string) => {
    const set = new Set(filters.sources);
    if (set.has(source)) {
      set.delete(source);
    } else {
      set.add(source);
    }
    onChange({ sources: [...set] });
  };

  return (
    <div className="filter-bar">
      <div className="tag-select" role="group" aria-label="Branch-Quelle">
        {sources.map((source) => {
          const active =
            filters.sources.length === 0 || filters.sources.includes(source);
          const explicit = filters.sources.includes(source);
          return (
            <button
              key={source}
              type="button"
              className={`tag ${explicit ? 'tag-active' : ''} ${
                active ? '' : 'tag-dimmed'
              }`}
              onClick={() => toggleSource(source)}
              title={`Filtern nach ${sourceLabel(source)}`}
            >
              {sourceLabel(source)}
            </button>
          );
        })}
        {filters.sources.length > 0 && (
          <button
            type="button"
            className="tag tag-clear"
            onClick={() => onChange({ sources: [] })}
            title="Alle Quellen anzeigen"
          >
            Alle
          </button>
        )}
      </div>

      <div className="search-row">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Branch-Name suchen..."
          value={filters.includePattern}
          onChange={(e) => onChange({ includePattern: e.target.value })}
        />
        <button
          type="button"
          className={`regex-toggle ${filters.includeRegex ? 'active' : ''}`}
          onClick={() => onChange({ includeRegex: !filters.includeRegex })}
          title="Regex verwenden"
        >
          .*
        </button>
      </div>

      <div className="search-row">
        <Ban size={14} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Branch-Name ausschliessen..."
          value={filters.excludePattern}
          onChange={(e) => onChange({ excludePattern: e.target.value })}
        />
        <button
          type="button"
          className={`regex-toggle ${filters.excludeRegex ? 'active' : ''}`}
          onClick={() => onChange({ excludeRegex: !filters.excludeRegex })}
          title="Regex verwenden"
        >
          .*
        </button>
      </div>

      <label className="ref-row">
        <GitBranch size={14} className="search-icon" />
        <span className="ref-label">Referenz</span>
        <select
          className="ref-select"
          value={filters.referenceBranch}
          onChange={(e) => onReferenceBranchChange(e.target.value)}
        >
          {refs.every((r) => r.fullName !== filters.referenceBranch) && (
            <option value={filters.referenceBranch}>{filters.referenceBranch || '(keiner)'}</option>
          )}
          {refs.map((r) => (
            <option key={r.fullName} value={r.fullName}>
              {r.name}
              {r.isCurrent ? ' (current)' : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="checkbox-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={filters.showInReference}
            onChange={(e) => onChange({ showInReference: e.target.checked })}
          />
          <span>Commits zeigen, die im Referenz-Branch sind</span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={filters.showMerged}
            onChange={(e) => onChange({ showMerged: e.target.checked })}
          />
          <span>Als gemergt markierte Commits zeigen</span>
        </label>
      </div>
    </div>
  );
}
