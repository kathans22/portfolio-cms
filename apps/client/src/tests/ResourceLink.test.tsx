import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResourceLink, truncateUrl } from '../components/admin/resources/ResourceLink';

describe('ResourceLink — render-time scheme check', () => {
  it('renders an http(s) link as a real anchor that opens safely in a new tab', () => {
    render(<ResourceLink link="https://example.com/docs/getting-started" />);

    const anchor = screen.getByRole('link');
    expect(anchor.getAttribute('href')).toBe('https://example.com/docs/getting-started');
    expect(anchor.getAttribute('target')).toBe('_blank');
    // Without noopener the opened page gets a handle on this window via window.opener.
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('refuses to render a javascript: URL as a link', () => {
    // Validation was added after the model existed, so a row written earlier could hold
    // this. The render-time check is the last thing between that value and an href the
    // admin is about to click.
    render(<ResourceLink link="javascript:alert(1)" />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/unsafe link scheme/i)).toBeTruthy();
  });

  it('refuses data: and file: too', () => {
    for (const link of ['data:text/html,<script>alert(1)</script>', 'file:///etc/passwd']) {
      const { unmount } = render(<ResourceLink link={link} />);
      expect(screen.queryByRole('link')).toBeNull();
      unmount();
    }
  });

  it('keeps the full URL in the title even when the visible text is truncated', () => {
    const long = `https://example.com/${'a'.repeat(300)}`;
    render(<ResourceLink link={long} />);

    const anchor = screen.getByRole('link');
    expect(anchor.getAttribute('title')).toBe(long);
    // A 300-character URL rendered raw destroys the table layout.
    expect((anchor.textContent ?? '').length).toBeLessThan(60);
  });
});

describe('truncateUrl', () => {
  it('shows host plus the head of the path', () => {
    expect(truncateUrl('https://fly.io/docs/reference')).toBe('fly.io/docs/reference');
  });

  it('drops a bare trailing slash rather than showing a dangling separator', () => {
    expect(truncateUrl('https://fly.io/')).toBe('fly.io');
  });

  it('elides a long path', () => {
    const result = truncateUrl(`https://example.com/${'x'.repeat(100)}`);
    expect(result.startsWith('example.com/')).toBe(true);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThan(50);
  });

  it('bounds an unparseable value instead of returning it whole', () => {
    const result = truncateUrl('not a url at all '.repeat(20));
    expect(result.length).toBeLessThanOrEqual(41);
  });
});
