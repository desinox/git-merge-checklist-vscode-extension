import { Copy, FileMinus2, FilePlus2, Files } from "lucide-react";
import type { CommitDetails, CommitInfo } from "../../src/git/types";
import { relativeTime } from "../relativeTime";
import { postMessage } from "../vscodeApi";
import { Avatar } from "./Avatar";

interface Props {
	commit: CommitInfo;
	details: CommitDetails | undefined;
	style: React.CSSProperties;
	onMouseEnter: () => void;
	onMouseLeave: () => void;
}

function formatAbsolute(iso: string): string {
	if (!iso) {
		return "";
	}
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function CommitHoverCard({
	commit,
	details,
	style,
	onMouseEnter,
	onMouseLeave,
}: Props) {
	const authorName = details?.authorName || commit.authorName;
	const authorEmail = details?.authorEmail || commit.authorEmail;
	const authorDate = details?.authorDate || commit.date;
	const message = details?.message || commit.subject;
	const fullHash = details?.hash || commit.hash;
	const showCommitter =
		details &&
		(details.committerName !== details.authorName ||
			details.committerEmail !== details.authorEmail ||
			details.committerDate !== details.authorDate);

	return (
		<div
			className="commit-hover"
			style={style}
			role="tooltip"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div className="hover-header">
				<Avatar
					url={details?.avatarUrl || commit.avatarUrl}
					name={authorName}
				/>
				<div className="hover-author">
					<span className="hover-author-name">{authorName}</span>
					{authorEmail && (
						<span className="hover-author-email">
							{authorEmail}
						</span>
					)}
				</div>
			</div>

			<div className="hover-message">{message}</div>

			<div className="hover-meta">
				<div className="hover-meta-row">
					<span className="hover-meta-label">authored</span>
					<span title={formatAbsolute(authorDate)}>
						{relativeTime(authorDate)} ·{" "}
						{formatAbsolute(authorDate)}
					</span>
				</div>
				{details && showCommitter && (
					<div className="hover-meta-row">
						<span className="hover-meta-label">committed</span>
						<span title={formatAbsolute(details.committerDate)}>
							{details.committerName} ·{" "}
							{relativeTime(details.committerDate)}
						</span>
					</div>
				)}
			</div>

			{details && details.filesChanged > 0 && (
				<div className="hover-stats">
					<span title="Files changed">
						<Files size={12} /> {details.filesChanged}
					</span>
					{details.insertions > 0 && (
						<span className="hover-stat-add" title="Insertions">
							<FilePlus2 size={12} /> {details.insertions}
						</span>
					)}
					{details.deletions > 0 && (
						<span className="hover-stat-del" title="Deletions">
							<FileMinus2 size={12} /> {details.deletions}
						</span>
					)}
				</div>
			)}

			<div className="hover-hash">
				<code>{fullHash}</code>
				<button
					type="button"
					className="icon-btn"
					title="Copy full hash"
					onClick={() =>
						postMessage({ type: "copyHash", hash: fullHash })
					}
				>
					<Copy size={13} />
				</button>
			</div>

			{!details && (
				<div className="hover-loading">Loading details...</div>
			)}
		</div>
	);
}
