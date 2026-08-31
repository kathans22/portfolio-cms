import React from 'react';
import { isHttpUrl } from '@portfolio/shared';
import { ExternalLink, ShieldAlert } from 'lucide-react';

/**
 * Renders a stored resource link as an anchor.
 *
 * The scheme is re-checked here, not only on write. Validation was added after the model
 * existed, so a row written earlier could hold `javascript:` — and this component is the
 * last thing between that value and an `href` the admin will click. Defence in depth: a
 * record that fails the check is shown as inert text with a warning rather than as a
 * working link.
 */
export function ResourceLink({ link }: { link: string }) {
  if (!isHttpUrl(link)) {
    return (
      <span
        title={link}
        className="inline-flex items-center gap-1.5 text-amber-400 text-xs"
      >
        <ShieldAlert size={13} aria-hidden="true" />
        <span className="font-mono truncate max-w-xs">{truncateUrl(link)}</span>
        <span className="sr-only">Unsafe link scheme — not rendered as a link</span>
      </span>
    );
  }

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      title={link}
      className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 hover:underline"
    >
      <span className="truncate max-w-xs">{truncateUrl(link)}</span>
      <ExternalLink size={12} className="shrink-0 opacity-60" aria-hidden="true" />
    </a>
  );
}

/**
 * Host plus the head of the path. A 200-character URL rendered raw destroys the table
 * layout and tells the reader nothing the host doesn't; the full value stays in `title`.
 */
export function truncateUrl(link: string, maxPath = 28): string {
  try {
    const url = new URL(link);
    const tail = `${url.pathname}${url.search}`.replace(/^\/$/, '');
    const shortTail = tail.length > maxPath ? `${tail.slice(0, maxPath)}…` : tail;
    return `${url.host}${shortTail}`;
  } catch {
    // Not parseable — show a bounded prefix rather than the whole string.
    return link.length > 40 ? `${link.slice(0, 40)}…` : link;
  }
}
