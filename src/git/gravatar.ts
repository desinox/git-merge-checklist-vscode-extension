import * as crypto from 'crypto';

/**
 * Builds a Gravatar URL from an email address. Uses `d=404` so that missing
 * avatars return an HTTP error, letting the webview fall back to an initials
 * badge via the image `onerror` handler.
 */
export function gravatarUrl(email: string, size = 48): string {
  const normalized = (email || '').trim().toLowerCase();
  const hash = crypto.createHash('md5').update(normalized).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}
