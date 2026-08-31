import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CmsNavDesktop, HARDCODED_NAV_PATHS } from '../components/public/CmsNav';

// What GET /nav returns after build-order step 11: the six backfilled pages that the
// header already links to by hand, plus a genuinely new admin-created page.
const NAV = [
  { id: '1', path: '/', label: 'Home', children: [] },
  { id: '2', path: '/projects', label: 'Work', children: [] },
  { id: '3', path: '/about', label: 'About', children: [] },
  { id: '4', path: '/certifications', label: 'Certifications', children: [] },
  { id: '5', path: '/blog', label: 'Blog', children: [] },
  { id: '6', path: '/contact', label: 'Contact', children: [] },
  { id: '7', path: '/guides', label: 'Guides', children: [] },
];

function renderNav() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CmsNavDesktop />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CmsNav', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => NAV })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders admin-created pages the header does not already link to', async () => {
    renderNav();
    expect(await screen.findByRole('link', { name: 'Guides' })).toBeTruthy();
  });

  it('omits pages the header already hardcodes, so nothing appears twice', async () => {
    renderNav();
    await screen.findByRole('link', { name: 'Guides' });

    // Step 11 backfilled /, /projects, /about, /certifications, /blog and /contact as
    // Page documents while the header still links to all six by hand. Without the
    // filter every one of them would render a second time.
    for (const label of ['Home', 'Work', 'About', 'Certifications', 'Blog', 'Contact']) {
      expect(screen.queryByRole('link', { name: label })).toBeNull();
    }
  });

  it('renders nothing at all when every page is already hardcoded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => NAV.filter((n) => n.path !== '/guides') }))
    );
    const { container } = (() => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <CmsNavDesktop />
          </MemoryRouter>
        </QueryClientProvider>
      );
    })();

    await waitFor(() => expect(container.querySelectorAll('a')).toHaveLength(0));
  });

  it('keeps the hardcoded path list in step with the header', () => {
    // If a route is cut over to the CMS, its path must leave this set at the same time,
    // or the page silently disappears from the navigation entirely.
    expect([...HARDCODED_NAV_PATHS].sort()).toEqual(
      ['/', '/about', '/blog', '/certifications', '/contact', '/projects'].sort()
    );
  });
});
