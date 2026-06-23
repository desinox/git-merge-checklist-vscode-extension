import type { BranchData, BranchRef, FileChange } from './git/types';

export interface FilterState {
  /** Selected branch sources: "local" and/or remote names. Empty = all. */
  sources: string[];
  includePattern: string;
  includeRegex: boolean;
  excludePattern: string;
  excludeRegex: boolean;
  /** Show commits that are also in the reference branch. Default false. */
  showInReference: boolean;
  /** Show commits marked as merged. Default false. */
  showMerged: boolean;
  /** Full name of the reference branch. */
  referenceBranch: string;
  /** Full names of branches the user collapsed. */
  collapsedBranches: string[];
}

export type CherryPickMode = 'pick' | 'edit' | 'no-commit';

/** Messages sent from the webview to the extension host. */
export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'requestData'; referenceBranch: string }
  | { type: 'getCommitFiles'; hash: string }
  | { type: 'openFile'; hash: string; file: string; oldPath?: string; status: string }
  | { type: 'copyHash'; hash: string }
  | { type: 'setMerged'; hash: string; merged: boolean }
  | { type: 'cherryPick'; hash: string; subject: string }
  | { type: 'saveFilters'; filters: FilterState };

/** Messages sent from the extension host to the webview. */
export type HostToWebview =
  | {
      type: 'init';
      refs: BranchRef[];
      sources: string[];
      currentBranch: string;
      mergedHashes: string[];
      filters: FilterState;
    }
  | { type: 'data'; branches: BranchData[]; referenceBranch: string }
  | { type: 'commitFiles'; hash: string; files: FileChange[] }
  | { type: 'mergedChanged'; hash: string; merged: boolean }
  | { type: 'loading'; value: boolean }
  | { type: 'error'; message: string };
