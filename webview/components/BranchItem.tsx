import { ChevronRight, ChevronDown, GitBranch } from 'lucide-react';
import type { BranchData, FileChange } from '../../src/git/types';
import { CommitItem } from './CommitItem';

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
          {branch.commits.map((commit) => (
            <CommitItem
              key={commit.hash}
              commit={commit}
              merged={mergedHashes.has(commit.hash)}
              files={commitFiles[commit.hash]}
              onToggleMerged={onToggleMerged}
              onRequestFiles={onRequestFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}
