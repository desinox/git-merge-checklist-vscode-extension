import {
	Check,
	ChevronDown,
	ChevronRight,
	GitBranch,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
	BranchData,
	CommitDetails,
	FileChange,
} from "../../src/git/types";
import { relativeTime } from "../relativeTime";
import { CommitItem } from "./CommitItem";

const PAGE_SIZE = 20;

interface Props {
	branch: BranchData;
	collapsed: boolean;
	fullyMerged: boolean;
	mergedHashes: Set<string>;
	commitFiles: Record<string, FileChange[]>;
	commitDetails: Record<string, CommitDetails>;
	onToggleCollapsed: () => void;
	onToggleMerged: (hash: string, merged: boolean) => void;
	onRequestFiles: (hash: string) => void;
	onRequestDetails: (hash: string) => void;
	onDelete: () => void;
}

export function BranchItem({
	branch,
	collapsed,
	fullyMerged,
	mergedHashes,
	commitFiles,
	commitDetails,
	onToggleCollapsed,
	onToggleMerged,
	onRequestFiles,
	onRequestDetails,
	onDelete,
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
		<div className={`branch ${fullyMerged ? "branch-merged" : ""}`}>
			{/* biome-ignore lint/a11y/useSemanticElements: header wraps a nested delete button, which a <button> cannot contain */}
			<div
				className="branch-header"
				role="button"
				tabIndex={0}
				onClick={onToggleCollapsed}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onToggleCollapsed();
					}
				}}
			>
				{collapsed ? (
					<ChevronRight size={15} />
				) : (
					<ChevronDown size={15} />
				)}
				<GitBranch size={14} className="branch-icon" />
				<span className="branch-name" title={branch.ref.fullName}>
					{branch.ref.name}
				</span>
				{branch.lastCommitDate && (
					<span
						className="branch-age"
						title={new Date(branch.lastCommitDate).toLocaleString()}
					>
						{relativeTime(branch.lastCommitDate)}
					</span>
				)}
				{fullyMerged ? (
					<span
						className="branch-done"
						title="All commits marked as merged"
					>
						<Check size={12} /> merged
					</span>
				) : (
					<span className="branch-count">
						{branch.commits.length}
					</span>
				)}
				<button
					type="button"
					className="icon-btn branch-delete"
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					title={
						branch.ref.type === "remote"
							? "Delete branch on remote"
							: "Delete local branch"
					}
				>
					<Trash2 size={14} />
				</button>
			</div>
			{!collapsed && (
				<div className="commit-list">
					{visibleCommits.map((commit) => (
						<CommitItem
							key={commit.hash}
							commit={commit}
							merged={mergedHashes.has(commit.hash)}
							files={commitFiles[commit.hash]}
							details={commitDetails[commit.hash]}
							onToggleMerged={onToggleMerged}
							onRequestFiles={onRequestFiles}
							onRequestDetails={onRequestDetails}
						/>
					))}
					{remaining > 0 && (
						<button
							type="button"
							className="load-more"
							onClick={() =>
								setVisibleCount((c) => c + PAGE_SIZE)
							}
						>
							Load more ({remaining} remaining)
						</button>
					)}
				</div>
			)}
		</div>
	);
}
