import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Markdown content comes from the admin (trusted-ish) but is stored and rendered
// through a browser context, so it's sanitized at render time as defense against
// stored XSS — a compromised admin session or a bug elsewhere shouldn't be able to
// inject a <script> that runs in every visitor's browser.
export function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked.parse(content) as string);
}
