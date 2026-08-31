import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Resolver from '../pages/public/Resolver';
import { sectionRegistry } from '../components/sections/registry';
import { SECTION_TYPES } from '@portfolio/shared';

function mockResolve(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/resolve')) return { ok: true, status: 200, json: async () => payload };
      // Analytics and anything else the page fires.
      return { ok: true, status: 204, json: async () => ({}) };
    })
  );
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/landed" element={<div>redirect target</div>} />
            <Route path="*" element={<Resolver />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

const page = (overrides: Record<string, unknown> = {}) => ({
  kind: 'PAGE',
  data: {
    id: 'p1',
    slug: 'guides',
    path: '/guides',
    title: 'Guides',
    sections: [],
    ancestors: [],
    noIndex: false,
    ...overrides,
  },
});

describe('Resolver', () => {
  beforeEach(() => {
    mockResolve(page());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the server what the URL means, passing the current path', async () => {
    renderAt('/guides');

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as [string][];
      expect(calls.some(([url]) => url.includes('/resolve?path=%2Fguides'))).toBe(true);
    });
  });

  it('renders a PAGE through the section system', async () => {
    mockResolve(
      page({
        sections: [
          {
            _id: 's1',
            type: 'HERO',
            heading: 'Welcome aboard',
            layoutVariant: 'default',
            styleOptions: {},
            isVisible: true,
            order: 0,
            items: [],
            contentBlocks: [],
          },
        ],
      })
    );

    renderAt('/guides');

    await waitFor(() => expect(screen.getByText('Welcome aboard')).toBeInTheDocument());
  });

  it('follows a REDIRECT instead of rendering the dead URL', async () => {
    mockResolve({ kind: 'REDIRECT', to: '/landed', status: 301 });

    renderAt('/old-path');

    await waitFor(() => expect(screen.getByText('redirect target')).toBeInTheDocument());
  });

  it('renders a not-found state for NOT_FOUND rather than bouncing to home', async () => {
    mockResolve({ kind: 'NOT_FOUND' });

    renderAt('/nowhere');

    await waitFor(() => expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument());
  });

  it('shows a deliberate empty state for a published page with no sections', async () => {
    mockResolve(page({ sections: [] }));

    renderAt('/guides');

    await waitFor(() => expect(screen.getByText(/doesn't have any content yet/i)).toBeInTheDocument());
  });

  it('skips an unknown section type instead of blanking the page', async () => {
    mockResolve(
      page({
        sections: [
          { _id: 'x', type: 'FROM_THE_FUTURE', layoutVariant: 'default', styleOptions: {}, isVisible: true, order: 0, items: [], contentBlocks: [] },
          { _id: 'y', type: 'HERO', heading: 'Still here', layoutVariant: 'default', styleOptions: {}, isVisible: true, order: 1, items: [], contentBlocks: [] },
        ],
      })
    );

    renderAt('/guides');

    // The database can run ahead of the deployed frontend; the rest of the page must
    // still render.
    await waitFor(() => expect(screen.getByText('Still here')).toBeInTheDocument());
  });

  it('renders breadcrumbs from the ancestor chain the server supplied', async () => {
    mockResolve(
      page({
        title: 'Deploying',
        ancestors: [{ id: 'a1', path: '/guides', title: 'Guides' }],
      })
    );

    renderAt('/guides/deploying');

    await waitFor(() => expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/guides');
  });
});

describe('section registry', () => {
  it('has a component for every type in the shared registry', () => {
    for (const type of Object.keys(SECTION_TYPES)) {
      expect(sectionRegistry[type as keyof typeof sectionRegistry], `missing component for ${type}`).toBeTruthy();
    }
  });

  it('registers no component the shared registry does not declare', () => {
    for (const type of Object.keys(sectionRegistry)) {
      expect(SECTION_TYPES).toHaveProperty(type);
    }
  });
});
