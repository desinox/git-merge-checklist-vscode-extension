import * as vscode from 'vscode';
import type { GitService } from '../git/GitService';
import type { StateStore } from '../state/StateStore';
import { DEFAULT_FILTERS } from '../state/StateStore';
import type { CherryPickMode, FilterState, HostToWebview, WebviewToHost } from '../messages';
import type { BranchRef } from '../git/types';
import { openCommitFileDiff, openDiffWithWorkingTree } from '../diff/CommitDiffProvider';
import * as path from 'path';

export class ChecklistViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'gitChecklist.panel';

  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly git: GitService,
    private readonly store: StateStore
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')]
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: WebviewToHost) =>
      this.handleMessage(msg)
    );
  }

  /** Triggered by the refresh command in the view title bar. */
  refresh(): void {
    if (!this.view) {
      return;
    }
    void this.sendInit();
  }

  private post(message: HostToWebview): void {
    this.view?.webview.postMessage(message);
  }

  private async handleMessage(msg: WebviewToHost): Promise<void> {
    try {
      switch (msg.type) {
        case 'ready':
          await this.sendInit();
          break;
        case 'requestData':
          await this.sendData(msg.referenceBranch);
          break;
        case 'getCommitFiles': {
          const files = await this.git.getCommitFiles(msg.hash);
          this.post({ type: 'commitFiles', hash: msg.hash, files });
          break;
        }
        case 'openFile':
          await this.openFile(msg.hash, msg.file, msg.status, msg.oldPath);
          break;
        case 'openWorkingFile':
          await this.openWorkingFile(msg.file);
          break;
        case 'diffWithWorking':
          await this.diffWithWorking(msg.hash, msg.file);
          break;
        case 'copyHash':
          await vscode.env.clipboard.writeText(msg.hash);
          vscode.window.setStatusBarMessage(
            `Commit hash copied: ${msg.hash.slice(0, 8)}`,
            2000
          );
          break;
        case 'setMerged':
          await this.store.setMerged(msg.hash, msg.merged);
          this.post({ type: 'mergedChanged', hash: msg.hash, merged: msg.merged });
          break;
        case 'cherryPick':
          await this.cherryPick(msg.hash, msg.subject);
          break;
        case 'deleteBranch':
          await this.deleteBranch(msg.ref);
          break;
        case 'saveFilters':
          await this.store.setFilters(msg.filters);
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.post({ type: 'error', message });
      vscode.window.showErrorMessage(`Git Merge Checklist: ${message}`);
    }
  }

  private async sendInit(): Promise<void> {
    if (!(await this.git.isRepo())) {
      this.post({ type: 'error', message: 'No git repository found in the workspace.' });
      return;
    }
    const refs = await this.git.getBranchRefs();
    const sources = await this.git.getSources(refs);
    const currentBranch = await this.git.getCurrentBranch();
    const mergedHashes = await this.store.getMergedHashes();
    const saved = await this.store.getFilters();
    const filters: FilterState = {
      ...DEFAULT_FILTERS,
      ...saved,
      referenceBranch: saved?.referenceBranch || currentBranch
    };

    this.post({ type: 'init', refs, sources, currentBranch, mergedHashes, filters });
    await this.sendData(filters.referenceBranch);
  }

  private async sendData(referenceBranch: string): Promise<void> {
    this.post({ type: 'loading', value: true });
    try {
      const branches = await this.git.getBranchData(referenceBranch);
      this.post({ type: 'data', branches, referenceBranch });
    } finally {
      this.post({ type: 'loading', value: false });
    }
  }

  private async openFile(
    hash: string,
    file: string,
    status: string,
    oldPath: string | undefined
  ): Promise<void> {
    const shortHash = hash.slice(0, 8);
    await openCommitFileDiff(this.git.root, hash, shortHash, file, status, oldPath);
  }

  /** Opens the file as it currently exists in the working tree. */
  private async openWorkingFile(file: string): Promise<void> {
    const uri = vscode.Uri.file(path.join(this.git.root, file));
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      vscode.window.showInformationMessage(
        `File does not exist in the current working tree: ${file}`
      );
      return;
    }
    await vscode.commands.executeCommand('vscode.open', uri, { preview: true });
  }

  /** Diffs the commit's version of a file against the working-tree version. */
  private async diffWithWorking(hash: string, file: string): Promise<void> {
    const uri = vscode.Uri.file(path.join(this.git.root, file));
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      vscode.window.showInformationMessage(
        `File does not exist in the current working tree: ${file}`
      );
      return;
    }
    await openDiffWithWorkingTree(this.git.root, hash, hash.slice(0, 8), file);
  }

  private async cherryPick(hash: string, subject: string): Promise<void> {
    const items: { label: string; description: string; mode: CherryPickMode }[] = [
      {
        label: '$(git-merge) Cherry Pick',
        description: 'Commit directly (keeps the original author)',
        mode: 'pick'
      },
      {
        label: '$(edit) Cherry Pick and Edit',
        description: 'Apply, then edit files/message and commit from Source Control',
        mode: 'edit'
      },
      {
        label: '$(git-commit) Cherry Pick without Commit',
        description: 'Apply only (uncommitted); the original author is kept when committing',
        mode: 'no-commit'
      }
    ];
    const choice = await vscode.window.showQuickPick(items, {
      title: `Cherry Pick: ${subject}`,
      placeHolder: hash.slice(0, 8)
    });
    if (!choice) {
      return;
    }
    try {
      await this.git.cherryPick(hash, choice.mode);
      if (choice.mode === 'edit') {
        // The changes are staged and CHERRY_PICK_HEAD is set, so the user can
        // edit files and the commit message and commit from the Source Control
        // view while keeping the original author.
        await vscode.commands.executeCommand('workbench.view.scm');
        vscode.window.showInformationMessage(
          'Cherry-pick applied. Edit files and the commit message as you like and commit from the Source Control view - the original author is preserved.'
        );
        return;
      }
      if (choice.mode === 'no-commit') {
        vscode.window.showInformationMessage(
          'Cherry-pick applied (without commit). The original author is preserved when committing.'
        );
      } else {
        vscode.window.showInformationMessage(
          `Cherry-pick successful: ${hash.slice(0, 8)}`
        );
      }
      await this.sendInit();
    } catch (err) {
      await this.handleCherryPickError(err);
    }
  }

  private async handleCherryPickError(err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    const isConflict = /conflict|after resolving|could not apply|fix conflicts/i.test(
      message
    );
    if (isConflict) {
      const action = await vscode.window.showErrorMessage(
        'Cherry-pick produced conflicts. Resolve them in Source Control and commit, or abort the cherry-pick.',
        { modal: false },
        'Abort cherry-pick'
      );
      if (action === 'Abort cherry-pick') {
        try {
          await this.git.cherryPickAbort();
          vscode.window.showInformationMessage('Cherry-pick aborted.');
          await this.sendInit();
        } catch (abortErr) {
          const m = abortErr instanceof Error ? abortErr.message : String(abortErr);
          vscode.window.showErrorMessage(`Abort failed: ${m}`);
        }
      }
      return;
    }
    vscode.window.showErrorMessage(`Cherry-pick failed: ${message}`);
  }

  private async deleteBranch(ref: BranchRef): Promise<void> {
    const isRemote = ref.type === 'remote';
    const confirm = await vscode.window.showWarningMessage(
      `Really delete branch "${ref.name}"?`,
      {
        modal: true,
        detail: isRemote
          ? `The branch will be deleted on remote "${ref.remote}" (git push --delete). This cannot be undone.`
          : 'The local branch will be deleted (git branch -D).'
      },
      'Delete'
    );
    if (confirm !== 'Delete') {
      return;
    }
    try {
      await this.git.deleteBranch(ref);
      vscode.window.showInformationMessage(`Branch deleted: ${ref.name}`);
      await this.sendInit();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to delete branch: ${message}`);
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.css')
    );
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Git Checklist</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
