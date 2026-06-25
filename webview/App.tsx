import { useEffect, useMemo, useRef, useState } from "react";
import type {
	BranchData,
	BranchRef,
	CommitDetails,
	FileChange,
} from "../src/git/types";
import type { FilterState, HostToWebview } from "../src/messages";
import { BranchItem } from "./components/BranchItem";
import { FilterBar } from "./components/FilterBar";
import { getState, onMessage, postMessage, setState } from "./vscodeApi";

/** Snapshot kept in the webview state for instant restore after a reload. */
interface PersistedState {
	refs: BranchRef[];
	sources: string[];
	branches: BranchData[];
	mergedHashes: string[];
	filters: FilterState;
}

const DEFAULT_FILTERS: FilterState = {
	sources: [],
	includePattern: "",
	includeRegex: false,
	excludePattern: "",
	excludeRegex: false,
	showInReference: false,
	showMerged: false,
	referenceBranch: "",
	collapsedBranches: [],
};

function matches(name: string, pattern: string, useRegex: boolean): boolean {
	if (!pattern) {
		return true;
	}
	if (useRegex) {
		try {
			return new RegExp(pattern, "i").test(name);
		} catch {
			// Invalid regex: treat as no match so the user notices.
			return false;
		}
	}
	return name.toLowerCase().includes(pattern.toLowerCase());
}

const persisted = getState<PersistedState>();

export function App() {
	const [refs, setRefs] = useState<BranchRef[]>(persisted?.refs ?? []);
	const [sources, setSources] = useState<string[]>(persisted?.sources ?? []);
	const [branches, setBranches] = useState<BranchData[]>(
		persisted?.branches ?? [],
	);
	const [mergedHashes, setMergedHashes] = useState<Set<string>>(
		new Set(persisted?.mergedHashes ?? []),
	);
	const [filters, setFilters] = useState<FilterState>(
		persisted?.filters ?? DEFAULT_FILTERS,
	);
	const [commitFiles, setCommitFiles] = useState<
		Record<string, FileChange[]>
	>({});
	const [commitDetails, setCommitDetails] = useState<
		Record<string, CommitDetails>
	>({});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | undefined>();
	const initialized = useRef(false);

	useEffect(() => {
		const dispose = onMessage((msg: HostToWebview) => {
			switch (msg.type) {
				case "init":
					setRefs(msg.refs);
					setSources(msg.sources);
					setMergedHashes(new Set(msg.mergedHashes));
					setFilters(msg.filters);
					setError(undefined);
					initialized.current = true;
					break;
				case "data":
					setBranches(msg.branches);
					break;
				case "commitFiles":
					setCommitFiles((prev) => ({
						...prev,
						[msg.hash]: msg.files,
					}));
					break;
				case "commitDetails":
					setCommitDetails((prev) => ({
						...prev,
						[msg.hash]: msg.details,
					}));
					break;
				case "mergedChanged":
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
				case "loading":
					setLoading(msg.value);
					break;
				case "error":
					setError(msg.message);
					break;
			}
		});
		postMessage({ type: "ready" });
		return dispose;
	}, []);

	// Persist filters whenever they change (after the first init).
	useEffect(() => {
		if (initialized.current) {
			postMessage({ type: "saveFilters", filters });
		}
	}, [filters]);

	// Keep a snapshot in the webview state so a full reload restores instantly
	// while fresh data is fetched in the background.
	useEffect(() => {
		setState({
			refs,
			sources,
			branches,
			mergedHashes: [...mergedHashes],
			filters,
		} satisfies PersistedState);
	}, [refs, sources, branches, mergedHashes, filters]);

	const updateFilters = (patch: Partial<FilterState>) => {
		setFilters((prev) => ({ ...prev, ...patch }));
	};

	const setReferenceBranch = (ref: string) => {
		updateFilters({ referenceBranch: ref });
		postMessage({ type: "requestData", referenceBranch: ref });
	};

	const toggleMerged = (hash: string, merged: boolean) => {
		postMessage({ type: "setMerged", hash, merged });
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
			postMessage({ type: "getCommitFiles", hash });
		}
	};

	const requestCommitDetails = (hash: string) => {
		if (!commitDetails[hash]) {
			postMessage({ type: "getCommitDetails", hash });
		}
	};

	const deleteBranch = (ref: BranchData["ref"]) => {
		postMessage({ type: "deleteBranch", ref });
	};

	const visibleBranches = useMemo(() => {
		const sourceSet = new Set(filters.sources);
		return (
			branches
				.filter(
					(b) =>
						filters.sources.length === 0 ||
						sourceSet.has(b.ref.source),
				)
				.filter((b) =>
					matches(
						b.ref.name,
						filters.includePattern,
						filters.includeRegex,
					),
				)
				.filter(
					(b) =>
						!filters.excludePattern ||
						!matches(
							b.ref.name,
							filters.excludePattern,
							filters.excludeRegex,
						),
				)
				.map((b) => {
					// Commits relevant to this branch (respecting the reference filter).
					const relevant = b.commits.filter(
						(c) => filters.showInReference || !c.inReference,
					);
					const unmerged = relevant.filter(
						(c) => !mergedHashes.has(c.hash),
					);
					// A branch whose relevant commits are all marked merged is "done".
					const fullyMerged =
						relevant.length > 0 && unmerged.length === 0;
					const commits = relevant.filter(
						(c) => filters.showMerged || !mergedHashes.has(c.hash),
					);
					return { ...b, commits, fullyMerged };
				})
				// Keep branches that still have something to show, plus fully-merged
				// branches (highlighted) so they can be reviewed/deleted.
				.filter((b) => b.fullyMerged || b.commits.length > 0)
		);
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
			{loading && branches.length === 0 && (
				<div className="status">Loading branches...</div>
			)}
			{!loading && !error && visibleBranches.length === 0 && (
				<div className="status">
					No branches/commits for the current filters.
				</div>
			)}
			<div className="branch-list">
				{visibleBranches.map((branch) => (
					<BranchItem
						key={branch.ref.fullName}
						branch={branch}
						collapsed={filters.collapsedBranches.includes(
							branch.ref.fullName,
						)}
						fullyMerged={branch.fullyMerged}
						mergedHashes={mergedHashes}
						commitFiles={commitFiles}
						commitDetails={commitDetails}
						onToggleCollapsed={() =>
							toggleBranchCollapsed(branch.ref.fullName)
						}
						onToggleMerged={toggleMerged}
						onRequestFiles={requestCommitFiles}
						onRequestDetails={requestCommitDetails}
						onDelete={() => deleteBranch(branch.ref)}
					/>
				))}
			</div>
		</div>
	);
}
