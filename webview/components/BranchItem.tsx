import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, GitBranch } from 'lucide-react';
import type { BranchData, FileChange } from '../../src/git/types';
import { CommitItem } from './CommitItem';

const PAGE_SIZE = 20;

interface Props {
  branch: BranchData;
  collapsed: boolean;
  mergedHashes: Set<string>;
  commitFiles: Record<string, FileChange[]>;
  onToggleCollapsed: () => void;
  onToggleMerged: (hash: string, merged: boolean) => void;
  onRequestFiles: (hash: string) => void;
}

export function BranchItem({
  branch,
  collapsed,
  mergedHashes,
  commitFiles,
  onToggleCollapsed,
  onToggleMerged,
  onRequestFiles
}: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset paging when the visible commit set shrinks (e.g. filter change).
  useEffect(() => {
    if (visibleCount > PAGE_SIZE && branch.commits.length <= PAGE_SIZE) {
      setVisibleCount(PAGE_SIZE);
    }
  }, [branch.commits.length, visibleCount]);

  const visibleCommits = branch.commits.slice(0, visibleCount);
  const remaining = branch.commits.length - visibleCommits.length;

  return (
    <div className="branch">
      <button type="button" className="branch-header" onClick={onToggleCollapsed}>
        {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        <GitBranch size={14} className="branch-icon" />
        <span className="branch-name" title={branch.ref.fullName}>
          {branch.ref.name}
        </span>
        <span className="branch-count">{branch.commits.length}</span>
      </button>
      {!collapsed && (
        <div className="commit-list">
          {visibleCommits.map((commit) => (
            <CommitItem
              key={commit.hash}
              commit={commit}
              merged={mergedHashes.has(commit.hash)}
              files={commitFiles[commit.hash]}
              onToggleMerged={onToggleMerged}
              onRequestFiles={onRequestFiles}
            />
          ))}
          {remaining > 0 && (
            <button
              type="button"
              className="load-more"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              Mehr laden ({remaining} verbleibend)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
