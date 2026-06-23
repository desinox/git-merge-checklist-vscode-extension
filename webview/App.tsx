import { useEffect, useMemo, useRef, useState } from 'react';
import type { BranchData, BranchRef, FileChange } from '../src/git/types';
import type { FilterState, HostToWebview } from '../src/messages';
import { onMessage, postMessage } from './vscodeApi';
import { FilterBar } from './components/FilterBar';
import { BranchItem } from './components/BranchItem';

const DEFAULT_FILTERS: FilterState = {
  sources: [],
  includePattern: '',
  includeRegex: false,
  excludePattern: '',
  excludeRegex: false,
  showInReference: false,
  showMerged: false,
  referenceBranch: '',
  collapsedBranches: []
};

function matches(name: string, pattern: string, useRegex: boolean): boolean {
  if (!pattern) {
    return true;
  }
  if (useRegex) {
    try {
      return new RegExp(pattern, 'i').test(name);
    } catch {
      // Invalid regex: treat as no match so the user notices.
      return false;
    }
  }
  return name.toLowerCase().includes(pattern.toLowerCase());
}

export function App() {
  const [refs, setRefs] = useState<BranchRef[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [mergedHashes, setMergedHashes] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [commitFiles, setCommitFiles] = useState<Record<string, FileChange[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const initialized = useRef(false);

  useEffect(() => {
    const dispose = onMessage((msg: HostToWebview) => {
      switch (msg.type) {
        case 'init':
          setRefs(msg.refs);
          setSources(msg.sources);
          setMergedHashes(new Set(msg.mergedHashes));
          setFilters(msg.filters);
          setError(undefined);
          initialized.current = true;
          break;
        case 'data':
          setBranches(msg.branches);
          break;
        case 'commitFiles':
          setCommitFiles((prev) => ({ ...prev, [msg.hash]: msg.files }));
          break;
        case 'mergedChanged':
          setMergedHashes((prev) => {
            const next = new Set(prev);
            if (msg.merged) {
              next.add(msg.hash);
            } else {
              next.delete(msg.hash);
            }
            return next;
          });
          break;
        case 'loading':
          setLoading(msg.value);
          break;
        case 'error':
          setError(msg.message);
          break;
      }
    });
    postMessage({ type: 'ready' });
    return dispose;
  }, []);

  // Persist filters whenever they change (after the first init).
  useEffect(() => {
    if (initialized.current) {
      postMessage({ type: 'saveFilters', filters });
    }
  }, [filters]);

  const updateFilters = (patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const setReferenceBranch = (ref: string) => {
    updateFilters({ referenceBranch: ref });
    postMessage({ type: 'requestData', referenceBranch: ref });
  };

  const toggleMerged = (hash: string, merged: boolean) => {
    postMessage({ type: 'setMerged', hash, merged });
  };

  const toggleBranchCollapsed = (fullName: string) => {
    setFilters((prev) => {
      const collapsed = new Set(prev.collapsedBranches);
      if (collapsed.has(fullName)) {
        collapsed.delete(fullName);
      } else {
        collapsed.add(fullName);
      }
      return { ...prev, collapsedBranches: [...collapsed] };
    });
  };

  const requestCommitFiles = (hash: string) => {
    if (!commitFiles[hash]) {
      postMessage({ type: 'getCommitFiles', hash });
    }
  };

  const visibleBranches = useMemo(() => {
    const sourceSet = new Set(filters.sources);
    return branches
      .filter((b) => filters.sources.length === 0 || sourceSet.has(b.ref.source))
      .filter((b) => matches(b.ref.name, filters.includePattern, filters.includeRegex))
      .filter(
        (b) =>
          !filters.excludePattern ||
          !matches(b.ref.name, filters.excludePattern, filters.excludeRegex)
      )
      .map((b) => ({
        ...b,
        commits: b.commits.filter((c) => {
          if (!filters.showInReference && c.inReference) {
            return false;
          }
          if (!filters.showMerged && mergedHashes.has(c.hash)) {
            return false;
          }
          return true;
        })
      }))
      .filter((b) => b.commits.length > 0);
  }, [branches, filters, mergedHashes]);

  return (
    <div className="app">
      <FilterBar
        sources={sources}
        refs={refs}
        filters={filters}
        onChange={updateFilters}
        onReferenceBranchChange={setReferenceBranch}
      />
      {error && <div className="error">{error}</div>}
      {loading && <div className="status">Lade Branches...</div>}
      {!loading && !error && visibleBranches.length === 0 && (
        <div className="status">Keine Branches/Commits fuer die aktuellen Filter.</div>
      )}
      <div className="branch-list">
        {visibleBranches.map((branch) => (
          <BranchItem
            key={branch.ref.fullName}
            branch={branch}
            collapsed={filters.collapsedBranches.includes(branch.ref.fullName)}
            mergedHashes={mergedHashes}
            commitFiles={commitFiles}
            onToggleCollapsed={() => toggleBranchCollapsed(branch.ref.fullName)}
            onToggleMerged={toggleMerged}
            onRequestFiles={requestCommitFiles}
          />
        ))}
      </div>
    </div>
  );
}
