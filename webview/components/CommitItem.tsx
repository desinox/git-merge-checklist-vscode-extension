import { useState } from 'react';
import {
  Merge,
  GitGraph,
  ChevronRight,
  ChevronDown,
  FileText,
  ExternalLink,
  GitCompare
} from 'lucide-react';
import type { CommitInfo, FileChange } from '../../src/git/types';
import { postMessage } from '../vscodeApi';
import { relativeTime } from '../relativeTime';
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
      <div
        className="commit-row"
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        title={expanded ? 'Hide files' : 'Show changed files'}
      >
        <span className="expander">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <Avatar url={commit.avatarUrl} name={commit.authorName} />
        <span className="commit-subject" title={commit.subject}>
          {commit.subject}
        </span>
        <span className="commit-age" title={new Date(commit.date).toLocaleString()}>
          {relativeTime(commit.date)}
        </span>
        <button
          type="button"
          className="commit-short"
          title={`Copy full hash (${commit.hash})`}
          onClick={(e) => {
            e.stopPropagation();
            postMessage({ type: 'copyHash', hash: commit.hash });
          }}
        >
          {commit.shortHash}
        </button>
        <div className="commit-actions">
          <button
            type="button"
            className={`icon-btn merge-toggle ${merged ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMerged(commit.hash, !merged);
            }}
            title={merged ? 'Mark as not merged' : 'Mark as merged'}
            aria-pressed={merged}
          >
            <Merge size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              postMessage({ type: 'cherryPick', hash: commit.hash, subject: commit.subject });
            }}
            title="Cherry-pick"
          >
            <GitGraph size={15} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="commit-files">
          {files === undefined && <div className="file-loading">Loading files...</div>}
          {files && files.length === 0 && (
            <div className="file-loading">No file changes.</div>
          )}
          {files?.map((file) => (
            <div
              key={`${file.status}:${file.path}`}
              className="file-row"
              role="button"
              tabIndex={0}
              onClick={() => openFile(file)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openFile(file);
                }
              }}
              title={file.oldPath ? `${file.oldPath} -> ${file.path}` : file.path}
            >
              <FileText size={13} className="file-icon" />
              <span className={`file-status ${statusClass(file.status)}`}>
                {file.status}
              </span>
              <span className="file-path">{file.path}</span>
              <div className="file-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="Open file in the current working tree"
                  onClick={(e) => {
                    e.stopPropagation();
                    postMessage({ type: 'openWorkingFile', file: file.path });
                  }}
                >
                  <ExternalLink size={13} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Compare with the file in the current working tree"
                  onClick={(e) => {
                    e.stopPropagation();
                    postMessage({ type: 'diffWithWorking', hash: commit.hash, file: file.path });
                  }}
                >
                  <GitCompare size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
