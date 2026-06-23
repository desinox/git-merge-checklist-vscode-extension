import { useState } from 'react';
import { Merge, Copy, GitGraph, ChevronRight, ChevronDown, FileText } from 'lucide-react';
import type { CommitInfo, FileChange } from '../../src/git/types';
import { postMessage } from '../vscodeApi';
import { Avatar } from './Avatar';

interface Props {
  commit: CommitInfo;
  merged: boolean;
  files: FileChange[] | undefined;
  onToggleMerged: (hash: string, merged: boolean) => void;
  onRequestFiles: (hash: string) => void;
}

function statusClass(status: string): string {
  const s = status[0];
  if (s === 'A') return 'file-added';
  if (s === 'D') return 'file-deleted';
  if (s === 'R' || s === 'C') return 'file-renamed';
  return 'file-modified';
}

export function CommitItem({
  commit,
  merged,
  files,
  onToggleMerged,
  onRequestFiles
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      onRequestFiles(commit.hash);
    }
  };

  const openFile = (file: FileChange) => {
    postMessage({
      type: 'openFile',
      hash: commit.hash,
      file: file.path,
      oldPath: file.oldPath,
      status: file.status
    });
  };

  return (
    <div className={`commit ${merged ? 'commit-merged' : ''}`}>
      <div className="commit-row">
        <button
          type="button"
          className="expander"
          onClick={toggleExpanded}
          title={expanded ? 'Dateien ausblenden' : 'Geaenderte Dateien anzeigen'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Avatar url={commit.avatarUrl} name={commit.authorName} />
        <span className="commit-subject" title={commit.subject}>
          {commit.subject}
        </span>
        <span className="commit-short" title={commit.hash}>
          {commit.shortHash}
        </span>
        <div className="commit-actions">
          <button
            type="button"
            className={`icon-btn merge-toggle ${merged ? 'active' : ''}`}
            onClick={() => onToggleMerged(commit.hash, !merged)}
            title={merged ? 'Als nicht gemergt markieren' : 'Als gemergt markieren'}
            aria-pressed={merged}
          >
            <Merge size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => postMessage({ type: 'copyHash', hash: commit.hash })}
            title="Commit-Hash kopieren"
          >
            <Copy size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() =>
              postMessage({ type: 'cherryPick', hash: commit.hash, subject: commit.subject })
            }
            title="Cherry-Pick"
          >
            <GitGraph size={15} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="commit-files">
          {files === undefined && <div className="file-loading">Lade Dateien...</div>}
          {files && files.length === 0 && (
            <div className="file-loading">Keine Dateiaenderungen.</div>
          )}
          {files?.map((file) => (
            <button
              type="button"
              key={`${file.status}:${file.path}`}
              className="file-row"
              onClick={() => openFile(file)}
              title={file.oldPath ? `${file.oldPath} -> ${file.path}` : file.path}
            >
              <FileText size={13} className="file-icon" />
              <span className={`file-status ${statusClass(file.status)}`}>
                {file.status}
              </span>
              <span className="file-path">{file.path}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
