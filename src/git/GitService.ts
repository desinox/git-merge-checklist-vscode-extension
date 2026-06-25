import { type SimpleGit, simpleGit } from "simple-git";
import type { CherryPickMode } from "../messages";
import { gravatarUrl } from "./gravatar";
import type {
	BranchData,
	BranchRef,
	CommitDetails,
	CommitInfo,
	FileChange,
} from "./types";

const FIELD_SEP = "\u001f";
const RECORD_SEP = "\u001e";
const MAX_COMMITS_PER_BRANCH = 100;
const MAX_REFERENCE_COMMITS = 20000;
/** Max number of `git log` calls running at once when loading branches. */
const FETCH_CONCURRENCY = 8;

/** Runs an async mapper over items with a bounded concurrency. */
async function mapLimit<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (true) {
			const index = next++;
			if (index >= items.length) {
				return;
			}
			results[index] = await fn(items[index]);
		}
	};
	const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
		worker(),
	);
	await Promise.all(workers);
	return results;
}

export class GitService {
	private git: SimpleGit;

	constructor(private readonly repoRoot: string) {
		// Run git non-interactively: there is no TTY/editor in the extension host,
		// so any command that would open an editor (e.g. cherry-pick that needs a
		// merge commit message) must not block. We force the editor to the `true`
		// command, which accepts the prefilled message and exits 0. simple-git
		// blocks GIT_EDITOR by default; allowUnsafeEditor opts in (safe here since
		// we hard-code the value rather than taking it from user input).
		this.git = simpleGit({
			baseDir: repoRoot,
			unsafe: { allowUnsafeEditor: true },
		}).env({
			...process.env,
			GIT_EDITOR: "true",
			GIT_SEQUENCE_EDITOR: "true",
		});
	}

	get root(): string {
		return this.repoRoot;
	}

	async isRepo(): Promise<boolean> {
		try {
			return await this.git.checkIsRepo();
		} catch {
			return false;
		}
	}

	async getCurrentBranch(): Promise<string> {
		try {
			const name = (
				await this.git.revparse(["--abbrev-ref", "HEAD"])
			).trim();
			return name === "HEAD" ? "" : name;
		} catch {
			return "";
		}
	}

	/** Lists local and remote branches (excluding remote HEAD pointers). */
	async getBranchRefs(): Promise<BranchRef[]> {
		const current = await this.getCurrentBranch();
		const format = ["%(refname:short)", "%(refname)"].join(FIELD_SEP);
		const raw = await this.git.raw([
			"for-each-ref",
			`--format=${format}`,
			"refs/heads",
			"refs/remotes",
		]);

		const refs: BranchRef[] = [];
		for (const line of raw.split("\n")) {
			if (!line.trim()) {
				continue;
			}
			const [shortName, fullRef] = line.split(FIELD_SEP);
			if (!fullRef) {
				continue;
			}
			if (fullRef.startsWith("refs/heads/")) {
				refs.push({
					name: shortName,
					fullName: shortName,
					type: "local",
					source: "local",
					isCurrent: shortName === current,
				});
			} else if (fullRef.startsWith("refs/remotes/")) {
				// Skip the remote's symbolic HEAD pointer. Note: git shortens
				// refs/remotes/origin/HEAD to just "origin", so we must check the
				// full ref name, not the short one.
				if (fullRef.endsWith("/HEAD")) {
					continue;
				}
				const remote = shortName.split("/")[0];
				refs.push({
					name: shortName,
					fullName: shortName,
					type: "remote",
					remote,
					source: remote,
					isCurrent: false,
				});
			}
		}
		return refs;
	}

	/** Returns the distinct branch sources: "local" plus each remote name. */
	async getSources(refs: BranchRef[]): Promise<string[]> {
		const set = new Set<string>();
		for (const ref of refs) {
			set.add(ref.source);
		}
		// Keep "local" first, then remotes alphabetically.
		const sources = [...set].filter((s) => s !== "local").sort();
		if (set.has("local")) {
			sources.unshift("local");
		}
		return sources;
	}

	private async getReferenceHashes(
		referenceBranch: string,
	): Promise<Set<string>> {
		if (!referenceBranch) {
			return new Set();
		}
		try {
			const raw = await this.git.raw([
				"log",
				`--max-count=${MAX_REFERENCE_COMMITS}`,
				"--format=%H",
				referenceBranch,
			]);
			return new Set(
				raw
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean),
			);
		} catch {
			return new Set();
		}
	}

	private async getCommitsForBranch(
		branchFullName: string,
		referenceHashes: Set<string>,
	): Promise<CommitInfo[]> {
		// %H hash, %h short, %s subject, %an author name, %ae author email, %cI committer ISO date
		const fields = ["%H", "%h", "%s", "%an", "%ae", "%cI"].join(FIELD_SEP);
		const raw = await this.git.raw([
			"log",
			`--max-count=${MAX_COMMITS_PER_BRANCH}`,
			`--format=${fields}${RECORD_SEP}`,
			branchFullName,
			"--",
		]);

		const commits: CommitInfo[] = [];
		for (const record of raw.split(RECORD_SEP)) {
			const line = record.replace(/^\n/, "").trim();
			if (!line) {
				continue;
			}
			const [hash, shortHash, subject, authorName, authorEmail, date] =
				line.split(FIELD_SEP);
			if (!hash) {
				continue;
			}
			commits.push({
				hash,
				shortHash,
				subject: subject ?? "",
				authorName: authorName ?? "",
				authorEmail: authorEmail ?? "",
				date: date ?? "",
				avatarUrl: gravatarUrl(authorEmail ?? ""),
				inReference: referenceHashes.has(hash),
			});
		}
		return commits;
	}

	/**
	 * Builds the full branch/commit model relative to a reference branch.
	 * Each commit carries an `inReference` flag so the webview can toggle the
	 * "show commits also in reference" filter without a re-query.
	 */
	async getBranchData(referenceBranch: string): Promise<BranchData[]> {
		const refs = await this.getBranchRefs();
		const referenceHashes = await this.getReferenceHashes(referenceBranch);

		const data = await mapLimit(refs, FETCH_CONCURRENCY, async (ref) => {
			const commits = await this.getCommitsForBranch(
				ref.fullName,
				referenceHashes,
			);
			const lastCommitDate = commits.length > 0 ? commits[0].date : "";
			return { ref, lastCommitDate, commits } as BranchData;
		});

		data.sort((a, b) => (a.lastCommitDate < b.lastCommitDate ? 1 : -1));
		return data;
	}

	async getCommitFiles(hash: string): Promise<FileChange[]> {
		const raw = await this.git.raw([
			"show",
			"--no-color",
			"--name-status",
			"--format=",
			hash,
		]);

		const files: FileChange[] = [];
		for (const line of raw.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}
			const parts = trimmed.split("\t");
			const raw = parts[0];
			// Normalize statuses like "R100"/"C75" to a single letter, matching the
			// way VS Code's source control shows them.
			const status = raw[0];
			if (status === "R" || status === "C") {
				// Rename/copy: status \t old \t new
				files.push({
					status,
					oldPath: parts[1],
					path: parts[2] ?? parts[1],
				});
			} else {
				files.push({ status, path: parts[1] });
			}
		}
		return files;
	}

	/** Loads extended metadata for a single commit (for the hover card). */
	async getCommitDetails(hash: string): Promise<CommitDetails> {
		// %B (raw body) can contain newlines, so it must be the last field. Each
		// other field is separated by FIELD_SEP; we rejoin everything after the
		// metadata back into the message.
		const fields = [
			"%H",
			"%h",
			"%an",
			"%ae",
			"%aI",
			"%cn",
			"%ce",
			"%cI",
		].join(FIELD_SEP);
		const raw = await this.git.raw([
			"show",
			"--no-color",
			"--no-patch",
			`--format=${fields}${FIELD_SEP}%B`,
			hash,
		]);
		const parts = raw.split(FIELD_SEP);
		const [
			fullHash,
			shortHash,
			authorName,
			authorEmail,
			authorDate,
			committerName,
			committerEmail,
			committerDate,
		] = parts;
		const message = parts.slice(8).join(FIELD_SEP).replace(/\n+$/, "");

		const stats = await this.getCommitStats(hash);

		return {
			hash: fullHash ?? hash,
			shortHash: shortHash ?? hash.slice(0, 8),
			authorName: authorName ?? "",
			authorEmail: authorEmail ?? "",
			authorDate: authorDate ?? "",
			committerName: committerName ?? "",
			committerEmail: committerEmail ?? "",
			committerDate: committerDate ?? "",
			message: message.trim(),
			avatarUrl: gravatarUrl(authorEmail ?? ""),
			...stats,
		};
	}

	private async getCommitStats(hash: string): Promise<{
		filesChanged: number;
		insertions: number;
		deletions: number;
	}> {
		try {
			const raw = await this.git.raw([
				"show",
				"--no-color",
				"--no-patch",
				"--shortstat",
				"--format=",
				hash,
			]);
			const line = raw.trim();
			const files = /(\d+)\s+files?\s+changed/.exec(line);
			const ins = /(\d+)\s+insertions?\(\+\)/.exec(line);
			const del = /(\d+)\s+deletions?\(-\)/.exec(line);
			return {
				filesChanged: files ? Number(files[1]) : 0,
				insertions: ins ? Number(ins[1]) : 0,
				deletions: del ? Number(del[1]) : 0,
			};
		} catch {
			return { filesChanged: 0, insertions: 0, deletions: 0 };
		}
	}

	/** Returns file contents at a given revision, or empty string if absent. */
	async getFileAtRevision(rev: string, filePath: string): Promise<string> {
		try {
			return await this.git.raw(["show", `${rev}:${filePath}`]);
		} catch {
			return "";
		}
	}

	async cherryPick(hash: string, mode: CherryPickMode): Promise<void> {
		if (mode === "pick") {
			// Native cherry-pick preserves the original author automatically.
			await this.git.raw(["cherry-pick", hash]);
			return;
		}
		// 'edit' and 'no-commit': apply without committing, but record
		// CHERRY_PICK_HEAD so the eventual commit (via the Source Control view or
		// our own commit) keeps the original author and message. A plain
		// `cherry-pick -n` does NOT set this, which is why a follow-up commit would
		// otherwise be attributed to the current user.
		await this.git.raw(["cherry-pick", "--no-commit", hash]);
		await this.git.raw(["update-ref", "CHERRY_PICK_HEAD", hash]);
	}

	async cherryPickAbort(): Promise<void> {
		await this.git.raw(["cherry-pick", "--abort"]);
	}

	/** Deletes a branch. Remote branches are deleted on their remote. */
	async deleteBranch(ref: BranchRef): Promise<void> {
		if (ref.type === "remote" && ref.remote) {
			const prefix = `${ref.remote}/`;
			const branchName = ref.name.startsWith(prefix)
				? ref.name.slice(prefix.length)
				: ref.name;
			await this.git.raw(["push", ref.remote, "--delete", branchName]);
		} else {
			await this.git.raw(["branch", "-D", ref.fullName]);
		}
	}
}
