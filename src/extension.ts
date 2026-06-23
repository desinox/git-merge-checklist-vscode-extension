import * as vscode from 'vscode';
import { GitService } from './git/GitService';
import { LocalStateStore } from './state/LocalStateStore';
import { ChecklistViewProvider } from './panel/ChecklistViewProvider';
import { CommitDiffProvider } from './diff/CommitDiffProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const repoRoot = await resolveRepoRoot();
  if (!repoRoot) {
    vscode.window.showWarningMessage(
      'Git Checklist: Kein Git-Repository im Workspace gefunden.'
    );
    return;
  }

  const git = new GitService(repoRoot);
  const store = new LocalStateStore(context.workspaceState);

  const diffProvider = new CommitDiffProvider(git);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      CommitDiffProvider.scheme,
      diffProvider
    )
  );

  const viewProvider = new ChecklistViewProvider(context.extensionUri, git, store);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChecklistViewProvider.viewType,
      viewProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitChecklist.refresh', () => viewProvider.refresh())
  );
}

export function deactivate(): void {
  // nothing to clean up
}

/**
 * Resolves the repository root, preferring the built-in Git extension's
 * detected repositories and falling back to the first workspace folder.
 */
async function resolveRepoRoot(): Promise<string | undefined> {
  try {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (gitExtension) {
      const exports = gitExtension.isActive
        ? gitExtension.exports
        : await gitExtension.activate();
      const api = exports.getAPI(1);
      if (api.repositories.length > 0) {
        return api.repositories[0].rootUri.fsPath;
      }
    }
  } catch {
    // fall through to workspace folder
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

interface GitExtension {
  getAPI(version: 1): {
    repositories: { rootUri: vscode.Uri }[];
  };
}
