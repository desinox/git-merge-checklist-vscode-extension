# Git Checklist

Eine VS-Code-Extension, um lokal den Ueberblick zu behalten, welche Branches und Commits du bereits cherry-gepickt bzw. uebernommen hast. Branches und ihre Commits werden in einem Sidebar-Panel dargestellt; einzelne Commits lassen sich als "gemergt" markieren, aufklappen (geaenderte Dateien + Diff) und direkt cherry-picken.

## Features

- Sidebar-Panel (Activity Bar) mit React-Webview.
- Oben: Multi-Select-Tags fuer die Branch-Quelle (Local branches, je Remote eines).
- Include- und Exclude-Suche nach Branch-Namen, jeweils als Text oder Regex.
- Referenz-Branch-Dropdown (Default: aktueller Branch).
- Zwei Filter-Checkboxen (Default aus):
  - Commits zeigen, die auch im Referenz-Branch sind.
  - Als gemergt markierte Commits zeigen.
- Branches sortiert nach letztem Commit, standardmaessig aufgeklappt und einklappbar.
- Pro Commit: Autor-Avatar (Gravatar mit Initialen-Fallback), Subject, Merge-Checkbox
  (markiert -> ausgegraut), Hash kopieren, Cherry-Pick.
- Cherry-Pick-Dialog: Cherry Pick / Cherry Pick and Edit / Cherry Pick without Commit.
- Commit aufklappbar -> geaenderte Dateien; Klick oeffnet eine Diff-View (Commit vs. Parent).

## Architektur

- `src/git/GitService.ts` - alle Git-Operationen ueber `simple-git`.
- `src/state/` - `StateStore`-Interface + `LocalStateStore` (Workspace-Memento).
  Bewusst abstrahiert, damit der State spaeter z. B. in einem eigenen Git-Branch
  oder ueber einen proprietaeren Sync abgelegt werden kann.
- `src/diff/CommitDiffProvider.ts` - `TextDocumentContentProvider` fuer Diff-Views.
- `src/panel/ChecklistViewProvider.ts` - Webview-Host + Message-Routing.
- `webview/` - React-UI (FilterBar, BranchItem, CommitItem, Avatar).

Host und Webview kommunizieren ueber ein typisiertes `postMessage`-Protokoll
(`src/messages.ts`).

## Entwicklung

Voraussetzungen: Node.js und Git.

```bash
npm install
npm run build      # einmaliger Build (esbuild: Extension + Webview)
npm run watch      # Build im Watch-Modus
```

Zum Starten in VS Code: Projekt oeffnen und `F5` druecken
("Run Extension"). Es oeffnet sich ein Extension Development Host; das Panel
findet sich in der Activity Bar ("Git Checklist").

## Bekannte Einschraenkungen / Annahmen

- Patch-Equivalenz (ob ein Commit bereits andernorts gepickt wurde) wird nicht
  automatisch erkannt; dafuer dient die manuelle Merge-Checkbox.
- Cherry-Pick erfolgt in den aktuell ausgecheckten Branch.
- Avatare kommen von Gravatar (anhand der Autor-E-Mail); ohne Treffer wird ein
  Initialen-Badge angezeigt.
