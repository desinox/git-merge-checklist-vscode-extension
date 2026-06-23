import type { FilterState } from '../messages';

/**
 * Abstraction over persistence so the merged/checked state and UI filters can
 * later be backed by something other than local workspace storage (e.g. a
 * dedicated git branch or a proprietary sync backend).
 */
export interface StateStore {
  getMergedHashes(): Promise<string[]>;
  isMerged(hash: string): Promise<boolean>;
  setMerged(hash: string, merged: boolean): Promise<void>;

  getFilters(): Promise<FilterState | undefined>;
  setFilters(filters: FilterState): Promise<void>;
}

export const DEFAULT_FILTERS: FilterState = {
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
