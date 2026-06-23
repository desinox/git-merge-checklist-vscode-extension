import * as vscode from 'vscode';
import * as path from 'path';
import type { GitService } from '../git/GitService';

interface DiffUriData {
  hash: string;
  /** Revision to read content from, e.g. "<hash>" or "<hash>^". */
  rev: string;
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

function buildUri(rev: string, hash: string, filePath: string): vscode.Uri {
  const data: DiffUriData = { hash, rev, filePath };
  // Keep the real file extension in the path so the diff editor picks the
  // correct language; encode the revision/path in the query.
  return vscode.Uri.from({
    scheme: CommitDiffProvider.scheme,
    path: `/${filePath}`,
    query: Buffer.from(JSON.stringify(data)).toString('base64')
  });
}

/**
 * Opens a diff editor showing what a given file looked like before and after a
 * commit. Added files show an empty left side; deleted files an empty right.
 */
export async function openCommitFileDiff(
  hash: string,
  shortHash: string,
  filePath: string,
  status: string,
  oldPath: string | undefined
): Promise<void> {
  const isAdded = status.startsWith('A');
  const isDeleted = status.startsWith('D');
  const leftPath = oldPath ?? filePath;

  const leftUri = buildUri(isAdded ? '' : `${hash}^`, hash, leftPath);
  const rightUri = buildUri(isDeleted ? '' : hash, hash, filePath);

  const title = `${path.basename(filePath)} (${shortHash})`;
  await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
    preview: true
  });
}
