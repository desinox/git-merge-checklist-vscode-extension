import type { HostToWebview, WebviewToHost } from '../src/messages';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

export function postMessage(message: WebviewToHost): void {
  vscode.postMessage(message);
}

export function onMessage(handler: (message: HostToWebview) => void): () => void {
  const listener = (event: MessageEvent) => handler(event.data as HostToWebview);
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
