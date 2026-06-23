# Git Merge Checklist

> Heads up: this is a vibe-coded side project. I built it because I kept missing
> this exact workflow in GitLens - a simple, local checklist to track which
> commits and branches I had already cherry-picked / merged. No guarantees, but 
> contributions and issues are welcome.

A VS Code / Cursor extension that gives you a local overview of which branches
and commits you have already handled. Branches and their commits are shown in a
sidebar panel; individual commits can be marked as "merged", expanded to inspect
changed files (with a diff view), and cherry-picked directly.

## Why

GitLens is great, but I wanted a lightweight, opinionated view focused on one
thing: a manual checklist for cherry-pick / merge work across many branches,
where I decide what counts as "done". The merged state is tracked locally, per
workspace, so it never touches your git history.

## Features

- Sidebar panel (Activity Bar) built as a webview.
- Top: multi-select tags for the branch source (local branches, one per remote).
- Include and exclude search over branch names, each as plain text or regex.
- Reference-branch dropdown (defaults to the current branch).
- Two filter checkboxes (off by default):
  - Show commits that are also in the reference branch.
  - Show commits marked as merged.
- Branches sorted by latest commit, expanded by default and collapsible.
- Per commit: author avatar (Gravatar with initials fallback), subject, a merge
  checkbox (marked = greyed out + struck through), copy hash, and cherry-pick.
- Cherry-pick dialog: Cherry Pick / Cherry Pick and Edit / Cherry Pick without Commit.
- Commits are expandable to list changed files; clicking a file opens a diff view
  (commit vs. parent).
- Commit lists are paginated (20 at a time) with a "load more" action.

## How the merged state is stored

The merged/checked state and the UI filters are stored in VS Code's per-workspace
`workspaceState` (an internal SQLite store managed by the editor), under the keys
`gitChecklist.mergedHashes` and `gitChecklist.filters`. It is **not** committed to
your repository and not shared via git.

Persistence sits behind a small `StateStore` interface (`src/state/`), so it can
later be backed by something else (e.g. a dedicated git branch or a custom sync)
without touching the UI or git layer.

## Architecture

- `src/git/GitService.ts` - all git operations via `simple-git`.
- `src/state/` - `StateStore` interface + `LocalStateStore` (workspace memento).
- `src/diff/CommitDiffProvider.ts` - `TextDocumentContentProvider` for diff views.
- `src/panel/ChecklistViewProvider.ts` - webview host + message routing.
- `webview/` - React UI (FilterBar, BranchItem, CommitItem, Avatar).

The host and the webview communicate over a typed `postMessage` protocol
(`src/messages.ts`).

## Development

Prerequisites: Node.js and Git.

```bash
npm install
npm run build      # one-off build (esbuild: extension + webview)
npm run watch      # build in watch mode
```

To run it in VS Code / Cursor: open the project and press `F5` ("Run Extension").
An Extension Development Host opens; the panel lives in the Activity Bar
("Git Merge Checklist").

## Packaging

```bash
npm run package        # produces a .vsix via @vscode/vsce
```

Install the resulting `.vsix` through the Extensions view ("Install from VSIX...").

## Known limitations / assumptions

- Patch equivalence (whether a commit was already cherry-picked elsewhere) is not
  detected automatically; the manual merge checkbox covers that.
- Cherry-pick is applied to the currently checked-out branch.
- Avatars come from Gravatar (based on the author email); without a match an
  initials badge is shown.

## License

MIT - see [LICENSE](LICENSE).
