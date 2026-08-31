import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResourcesManager from '../pages/admin/ResourcesManager';

const MAIN_TYPES = [
  { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Infrastructure' },
  { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Documentation' },
];

const SUB_TYPES: Record<string, { id: string; name: string }[]> = {
  aaaaaaaaaaaaaaaaaaaaaaaa: [{ id: 'cccccccccccccccccccccccc', name: 'Hosting' }],
  bbbbbbbbbbbbbbbbbbbbbbbb: [{ id: 'dddddddddddddddddddddddd', name: 'Guides' }],
};

const RESOURCES = {
  items: [
    {
      id: 'eeeeeeeeeeeeeeeeeeeeeeee',
      link: 'https://fly.io/docs',
      description: 'Deployment platform.',
      status: 'ACTIVE',
      mainTypeId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      subTypeId: 'cccccccccccccccccccccccc',
      mainTypeName: 'Infrastructure',
      subTypeName: 'Hosting',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

const requestedUrls: string[] = [];

function stubFetch(resources = RESOURCES) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requestedUrls.push(url);
      if (url.includes('/main-types/options')) {
        return { ok: true, status: 200, json: async () => MAIN_TYPES };
      }
      if (url.includes('/sub-types/options')) {
        const mainTypeId = new URL(url, 'http://x').searchParams.get('mainTypeId') ?? '';
        return { ok: true, status: 200, json: async () => SUB_TYPES[mainTypeId] ?? [] };
      }
      return { ok: true, status: 200, json: async () => resources };
    })
  );
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/resources']}>
        <ResourcesManager />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ResourcesManager', () => {
  beforeEach(() => {
    requestedUrls.length = 0;
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the row with its joined type names and a working link', async () => {
    renderPage();
    await screen.findAllByRole('link', { name: /fly\.io/ });

    // jsdom applies no CSS, so the responsive desktop table and the mobile card list are
    // both mounted. Scope to the table rather than asserting a single match.
    const table = screen.getByRole('table');
    expect(within(table).getByRole('link', { name: /fly\.io/ })).toBeTruthy();
    expect(within(table).getByText('Infrastructure')).toBeTruthy();
    expect(within(table).getByText('Hosting')).toBeTruthy();
  });

  it('disables the sub type filter until a main type is chosen', async () => {
    renderPage();
    await screen.findAllByRole('link', { name: /fly\.io/ });

    const subFilter = screen.getByLabelText('Filter by sub type') as HTMLSelectElement;
    expect(subFilter.disabled).toBe(true);
    expect(subFilter.textContent).toMatch(/pick a main type first/i);
  });

  it('clears the sub type filter when the main type filter changes', async () => {
    renderPage();
    await screen.findAllByRole('link', { name: /fly\.io/ });

    const mainFilter = screen.getByLabelText('Filter by main type');
    fireEvent.change(mainFilter, { target: { value: 'aaaaaaaaaaaaaaaaaaaaaaaa' } });

    const subFilter = await screen.findByLabelText('Filter by sub type');
    await waitFor(() => expect((subFilter as HTMLSelectElement).disabled).toBe(false));
    fireEvent.change(subFilter, { target: { value: 'cccccccccccccccccccccccc' } });
    await waitFor(() => expect((subFilter as HTMLSelectElement).value).toBe('cccccccccccccccccccccccc'));

    // Switching the main type must drop the stale sub type — keeping it would send a
    // mismatched pair the server rejects, and would look like the filter was broken.
    fireEvent.change(mainFilter, { target: { value: 'bbbbbbbbbbbbbbbbbbbbbbbb' } });
    await waitFor(() => expect((screen.getByLabelText('Filter by sub type') as HTMLSelectElement).value).toBe(''));
  });

  it('clears the sub type from FORM STATE when the main type changes, not just from the DOM', async () => {
    renderPage();
    await screen.findAllByRole('link', { name: /fly\.io/ });

    fireEvent.click(screen.getByRole('button', { name: /new resource/i }));

    fireEvent.change(await screen.findByLabelText('Link'), {
      target: { value: 'https://example.com/new' },
    });

    const mainSelect = await screen.findByLabelText('Main type');
    fireEvent.change(mainSelect, { target: { value: 'aaaaaaaaaaaaaaaaaaaaaaaa' } });

    const subSelect = await screen.findByLabelText('Sub type');
    await waitFor(() => expect((subSelect as HTMLSelectElement).disabled).toBe(false));
    fireEvent.change(subSelect, { target: { value: 'cccccccccccccccccccccccc' } });
    await waitFor(() => expect((subSelect as HTMLSelectElement).value).toBe('cccccccccccccccccccccccc'));

    // Switch to a main type that does not own that sub type, then submit immediately.
    fireEvent.change(mainSelect, { target: { value: 'bbbbbbbbbbbbbbbbbbbbbbbb' } });
    await waitFor(() => expect((screen.getByLabelText('Sub type') as HTMLSelectElement).value).toBe(''));

    const writesBefore = requestedUrls.filter((url) => url.includes('/admin/resources') && !url.includes('?')).length;
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    // Asserting the DOM value alone proves nothing: when the options refetch, the stale
    // <option> no longer exists and jsdom blanks the select by itself. The hazard is that
    // react-hook-form still holds the old id while the DOM looks empty — so submitting is
    // what actually distinguishes a real reset from an apparent one. With the reset,
    // validation blocks the submit; without it, a mismatched pair is posted.
    await waitFor(() => expect(screen.getByText(/a sub type is required/i)).toBeTruthy());

    const writesAfter = requestedUrls.filter((url) => url.includes('/admin/resources') && !url.includes('?')).length;
    expect(writesAfter).toBe(writesBefore);
  });

  it('only requests sub type options for the chosen main type', async () => {
    renderPage();
    await screen.findAllByRole('link', { name: /fly\.io/ });

    fireEvent.change(screen.getByLabelText('Filter by main type'), {
      target: { value: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
    });

    await waitFor(() =>
      expect(requestedUrls.some((url) => url.includes('/sub-types/options?mainTypeId=aaaaaaaaaaaaaaaaaaaaaaaa'))).toBe(true)
    );
    // A dependent dropdown must never fetch the whole collection.
    expect(requestedUrls.some((url) => /\/sub-types\/options(\?)?$/.test(url))).toBe(false);
  });

  it('puts filter state in the URL so a filtered view survives a refresh', async () => {
    renderPage();
    await screen.findAllByRole('link', { name: /fly\.io/ });

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'INACTIVE' } });

    await waitFor(() => expect(requestedUrls.some((url) => url.includes('status=INACTIVE'))).toBe(true));
  });

  it('distinguishes an empty collection from an over-filtered one', async () => {
    vi.unstubAllGlobals();
    stubFetch({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    renderPage();

    // No filters applied: offer the create path.
    expect(await screen.findByText(/no resources yet/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /create the first one/i })).toBeTruthy();
  });
});
