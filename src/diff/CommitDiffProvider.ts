import * as vscode from 'vscode';
import * as path from 'path';
import type { GitService } from '../git/GitService';

interface DiffUriData {
  hash: string;
  /** Revision to read content from, e.g. "<hash>" or "<hash>^". */
  rev: string;
  /** Repo-relative path used for `git show <rev>:<path>`. */
  filePath: string;
}

/**
 * Provides read-only file contents at a specific git revision so the built-in
 * diff editor can compare a commit against its parent. Mirrors the approach
 * used by git-graph's DiffDocProvider.
 */
export class CommitDiffProvider implements vscode.TextDocumentContentProvider {
  static readonly scheme = 'gitchecklist';

  constructor(private readonly git: GitService) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    try {
      const data = JSON.parse(
        Buffer.from(uri.query, 'base64').toString('utf8')
      ) as DiffUriData;
      if (!data.rev) {
        return '';
      }
      return await this.git.getFileAtRevision(data.rev, data.filePath);
    } catch {
      return '';
    }
  }
}

/**
 * Builds a URI for our content provider. The path is the absolute on-disk path
 * so the diff editor shows proper breadcrumbs (relative to the workspace
 * folder), while the revision and repo-relative path travel in the query.
 */
function buildUri(
  repoRoot: string,
  rev: string,
  hash: string,
  filePath: string
): vscode.Uri {
  const data: DiffUriData = { hash, rev, filePath };
  return vscode.Uri.from({
    scheme: CommitDiffProvider.scheme,
    path: path.join(repoRoot, filePath),
    query: Buffer.from(JSON.stringify(data)).toString('base64')
  });
}

/**
 * Opens a diff editor showing what a given file looked like before and after a
 * commit. Added files show an empty left side; deleted files an empty right.
 */
export async function openCommitFileDiff(
  repoRoot: string,
  hash: string,
  shortHash: string,
  filePath: string,
  status: string,
  oldPath: string | undefined
): Promise<void> {
  const isAdded = status.startsWith('A');
  const isDeleted = status.startsWith('D');
  const leftPath = oldPath ?? filePath;

  const leftUri = buildUri(repoRoot, isAdded ? '' : `${hash}^`, hash, leftPath);
  const rightUri = buildUri(repoRoot, isDeleted ? '' : hash, hash, filePath);

  const title = `${path.basename(filePath)} (${shortHash})`;
  await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
    preview: true
  });
}

/**
 * Diffs the file as it was in the given commit against the version currently in
 * the working tree (the checked-out branch).
 */
export async function openDiffWithWorkingTree(
  repoRoot: string,
  hash: string,
  shortHash: string,
  filePath: string
): Promise<void> {
  const leftUri = buildUri(repoRoot, hash, hash, filePath);
  const rightUri = vscode.Uri.file(path.join(repoRoot, filePath));

  const title = `${path.basename(filePath)} (${shortHash} \u2194 Working Tree)`;
  await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
    preview: true
  });
}
