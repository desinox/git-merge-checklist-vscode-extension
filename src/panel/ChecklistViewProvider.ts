import * as vscode from 'vscode';
import type { GitService } from '../git/GitService';
import type { StateStore } from '../state/StateStore';
import { DEFAULT_FILTERS } from '../state/StateStore';
import type { CherryPickMode, FilterState, HostToWebview, WebviewToHost } from '../messages';
import { openCommitFileDiff } from '../diff/CommitDiffProvider';

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
        case 'copyHash':
          await vscode.env.clipboard.writeText(msg.hash);
          vscode.window.setStatusBarMessage(
            `Commit hash kopiert: ${msg.hash.slice(0, 8)}`,
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
        case 'saveFilters':
          await this.store.setFilters(msg.filters);
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.post({ type: 'error', message });
      vscode.window.showErrorMessage(`Git Checklist: ${message}`);
    }
  }

  private async sendInit(): Promise<void> {
    if (!(await this.git.isRepo())) {
      this.post({ type: 'error', message: 'Kein Git-Repository im Workspace gefunden.' });
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
    await openCommitFileDiff(hash, shortHash, file, status, oldPath);
  }

  private async cherryPick(hash: string, subject: string): Promise<void> {
    const items: { label: string; description: string; mode: CherryPickMode }[] = [
      { label: '$(git-merge) Cherry Pick', description: 'Commit uebernehmen', mode: 'pick' },
      {
        label: '$(edit) Cherry Pick and Edit',
        description: 'Mit Editieren der Commit-Message (--edit)',
        mode: 'edit'
      },
      {
        label: '$(git-commit) Cherry Pick without Commit',
        description: 'Aenderungen ohne Commit uebernehmen (--no-commit)',
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
      vscode.window.showInformationMessage(
        `Cherry-Pick erfolgreich: ${hash.slice(0, 8)}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Cherry-Pick fehlgeschlagen: ${message}`);
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
