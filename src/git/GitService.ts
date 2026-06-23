import { simpleGit, SimpleGit } from 'simple-git';
import type { BranchData, BranchRef, CommitInfo, FileChange } from './types';
import type { CherryPickMode } from '../messages';
import { gravatarUrl } from './gravatar';

const FIELD_SEP = '\u001f';
const RECORD_SEP = '\u001e';
const MAX_COMMITS_PER_BRANCH = 200;
const MAX_REFERENCE_COMMITS = 20000;

export class GitService {
  private git: SimpleGit;

  constructor(private readonly repoRoot: string) {
    this.git = simpleGit(repoRoot);
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
      const name = (await this.git.revparse(['--abbrev-ref', 'HEAD'])).trim();
      return name === 'HEAD' ? '' : name;
    } catch {
      return '';
    }
  }

  /** Lists local and remote branches (excluding remote HEAD pointers). */
  async getBranchRefs(): Promise<BranchRef[]> {
    const current = await this.getCurrentBranch();
    const format = ['%(refname:short)', '%(refname)'].join(FIELD_SEP);
    const raw = await this.git.raw([
      'for-each-ref',
      `--format=${format}`,
      'refs/heads',
      'refs/remotes'
    ]);

    const refs: BranchRef[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) {
        continue;
      }
      const [shortName, fullRef] = line.split(FIELD_SEP);
      if (!fullRef) {
        continue;
      }
      if (fullRef.startsWith('refs/heads/')) {
        refs.push({
          name: shortName,
          fullName: shortName,
          type: 'local',
          source: 'local',
          isCurrent: shortName === current
        });
      } else if (fullRef.startsWith('refs/remotes/')) {
        // Skip symbolic refs like origin/HEAD.
        if (shortName.endsWith('/HEAD')) {
          continue;
        }
        const remote = shortName.split('/')[0];
        refs.push({
          name: shortName,
          fullName: shortName,
          type: 'remote',
          remote,
          source: remote,
          isCurrent: false
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
    const sources = [...set].filter((s) => s !== 'local').sort();
    if (set.has('local')) {
      sources.unshift('local');
    }
    return sources;
  }

  private async getReferenceHashes(referenceBranch: string): Promise<Set<string>> {
    if (!referenceBranch) {
      return new Set();
    }
    try {
      const raw = await this.git.raw([
        'log',
        `--max-count=${MAX_REFERENCE_COMMITS}`,
        '--format=%H',
        referenceBranch
      ]);
      return new Set(raw.split('\n').map((l) => l.trim()).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  private async getCommitsForBranch(
    branchFullName: string,
    referenceHashes: Set<string>
  ): Promise<CommitInfo[]> {
    // %H hash, %h short, %s subject, %an author name, %ae author email, %cI committer ISO date
    const fields = ['%H', '%h', '%s', '%an', '%ae', '%cI'].join(FIELD_SEP);
    const raw = await this.git.raw([
      'log',
      `--max-count=${MAX_COMMITS_PER_BRANCH}`,
      `--format=${fields}${RECORD_SEP}`,
      branchFullName,
      '--'
    ]);

    const commits: CommitInfo[] = [];
    for (const record of raw.split(RECORD_SEP)) {
      const line = record.replace(/^\n/, '').trim();
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
        subject: subject ?? '',
        authorName: authorName ?? '',
        authorEmail: authorEmail ?? '',
        date: date ?? '',
        avatarUrl: gravatarUrl(authorEmail ?? ''),
        inReference: referenceHashes.has(hash)
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

    const data = await Promise.all(
      refs.map(async (ref) => {
        const commits = await this.getCommitsForBranch(ref.fullName, referenceHashes);
        const lastCommitDate = commits.length > 0 ? commits[0].date : '';
        return { ref, lastCommitDate, commits } as BranchData;
      })
    );

    data.sort((a, b) => (a.lastCommitDate < b.lastCommitDate ? 1 : -1));
    return data;
  }

  async getCommitFiles(hash: string): Promise<FileChange[]> {
    const raw = await this.git.raw([
      'show',
      '--no-color',
      '--name-status',
      '--format=',
      hash
    ]);

    const files: FileChange[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const parts = trimmed.split('\t');
      const status = parts[0];
      if (status.startsWith('R') || status.startsWith('C')) {
        // Rename/copy: status \t old \t new
        files.push({ status, oldPath: parts[1], path: parts[2] ?? parts[1] });
      } else {
        files.push({ status, path: parts[1] });
      }
    }
    return files;
  }

  /** Returns file contents at a given revision, or empty string if absent. */
  async getFileAtRevision(rev: string, filePath: string): Promise<string> {
    try {
      return await this.git.raw(['show', `${rev}:${filePath}`]);
    } catch {
      return '';
    }
  }

  async cherryPick(hash: string, mode: CherryPickMode): Promise<void> {
    const args = ['cherry-pick'];
    if (mode === 'edit') {
      args.push('--edit');
    } else if (mode === 'no-commit') {
      args.push('--no-commit');
    }
    args.push(hash);
    await this.git.raw(args);
  }
}
