/**
 * Input sanitization utilities — pure string operations, no innerHTML.
 * Safe to use for display in React (JSX auto-escapes) and DB storage.
 */

/** Strip all HTML tags and decode common HTML entities */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00]/g, ''); // null bytes
}

/** Normalize whitespace — collapse multiple spaces/newlines */
export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/** Sanitize a plain text field: strip HTML + collapse whitespace + truncate */
export function sanitizeText(input: string, maxLen = 500): string {
  return normalizeWhitespace(stripHtml(input)).slice(0, maxLen);
}

/** Validate and sanitize a phone number — digits, +, -, (, ), space only */
export function sanitizePhone(input: string): string {
  return input.replace(/[^\d\s+\-()]/g, '').slice(0, 20);
}

/** Validate a URL is safe (http/https only, no javascript:) */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Guard against open-redirect: only allow relative paths */
export function safeRedirectPath(path: string, fallback = '/dashboard'): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback;
  // Prevent protocol-relative and encoded redirects
  if (/^[/][/\\]/.test(path)) return fallback;
  return path;
}
