export type BranchType = "local" | "remote";

export interface BranchRef {
	/** Display name, e.g. "feature/foo" or "origin/feature/foo". */
	name: string;
	/** Full ref usable in git commands, e.g. "feature/foo" or "origin/feature/foo". */
	fullName: string;
	type: BranchType;
	/** Remote name for remote branches, e.g. "origin". Undefined for local. */
	remote?: string;
	/** Source bucket used by the filter tags: "local" or the remote name. */
	source: string;
	isCurrent: boolean;
}

export interface CommitInfo {
	hash: string;
	shortHash: string;
	subject: string;
	authorName: string;
	authorEmail: string;
	/** ISO date string of the commit (committer date). */
	date: string;
	avatarUrl: string;
	/** True if this commit is reachable from the selected reference branch. */
	inReference: boolean;
}

export interface BranchData {
	ref: BranchRef;
	/** ISO date of the most recent commit on the branch. */
	lastCommitDate: string;
	commits: CommitInfo[];
}

/** Extended commit metadata loaded lazily for the hover card. */
export interface CommitDetails {
	hash: string;
	shortHash: string;
	authorName: string;
	authorEmail: string;
	/** ISO author date. */
	authorDate: string;
	committerName: string;
	committerEmail: string;
	/** ISO committer date. */
	committerDate: string;
	/** Full commit message (subject + body). */
	message: string;
	avatarUrl: string;
	/** Number of files changed in the commit. */
	filesChanged: number;
	insertions: number;
	deletions: number;
}

export interface FileChange {
	/** Git status letter: A, M, D, R, C, etc. */
	status: string;
	path: string;
	/** Original path for renames/copies. */
	oldPath?: string;
}
