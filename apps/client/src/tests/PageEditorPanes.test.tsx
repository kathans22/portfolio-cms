import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SECTION_TYPES, SECTION_TYPE_KEYS } from '@portfolio/shared';
import type { PageSection } from '@portfolio/types';
import { SectionList } from '../components/admin/pageEditor/SectionList';
import { QueryBuilder } from '../components/admin/pageEditor/QueryBuilder';

function section(overrides: Partial<PageSection> = {}): PageSection {
  return {
    type: 'HERO',
    heading: '',
    isVisible: true,
    order: 0,
    layoutVariant: 'default',
    styleOptions: {
      background: 'none', paddingY: 'lg', maxWidth: 'default',
      columns: 3, alignment: 'left', dividerAbove: false,
    },
    ...overrides,
  };
}

const EMPTY_QUERY = {
  domains: [], tags: [], skillIds: [], featuredOnly: false,
  limit: 0, sortBy: 'order', sortDir: 'asc' as const, includeExpired: false,
};

function renderList(sections: PageSection[], onChange = vi.fn()) {
  render(
    <SectionList sections={sections} selectedIndex={0} onSelect={vi.fn()} onChange={onChange} />
  );
  return { onChange };
}

describe('Section 6.2 Add Section picker', () => {
  it('offers every registered type, so a new SECTION_TYPES entry needs no edit here', () => {
    renderList([]);
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    for (const type of SECTION_TYPE_KEYS) {
      expect(screen.getByRole('button', { name: new RegExp(SECTION_TYPES[type].label, 'i') })).toBeTruthy();
    }
  });

  it('groups the types by kind rather than listing fifteen options flat', () => {
    renderList([]);
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.getByText('Collections')).toBeTruthy();
    expect(screen.getByText('Widgets')).toBeTruthy();
  });

  it('adds a section pre-set to its type’s first registered variant', () => {
    const { onChange } = renderList([]);
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.click(screen.getByRole('button', { name: /Projects/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const added = onChange.mock.calls[0][0][0] as PageSection;
    expect(added.type).toBe('PROJECT_LIST');
    // A variant outside the registry fails server-side validation on save.
    expect(SECTION_TYPES.PROJECT_LIST.variants).toContain(added.layoutVariant);
  });
});

describe('Section 6.2 section list rows', () => {
  it('toggles visibility without deleting the section', () => {
    const { onChange } = renderList([section({ heading: 'Intro' })]);
    fireEvent.click(screen.getByRole('button', { name: /hide section/i }));

    const next = onChange.mock.calls[0][0] as PageSection[];
    expect(next).toHaveLength(1);
    expect(next[0].isVisible).toBe(false);
  });

  it('duplicates without copying the subdocument id, so the copy is a new section', () => {
    const { onChange } = renderList([section({ _id: 'abc123', heading: 'Intro' })]);
    fireEvent.click(screen.getByRole('button', { name: /duplicate section/i }));

    const next = onChange.mock.calls[0][0] as PageSection[];
    expect(next).toHaveLength(2);
    expect(next[1]._id).toBeUndefined();
    expect(next[1].heading).toBe('Intro');
  });

  it('falls back to the type label when a section has no heading', () => {
    renderList([section({ type: 'CTA_BANNER', heading: '' })]);
    expect(screen.getByText('Call to Action')).toBeTruthy();
  });
});

describe('Section 6.2 query builder result count', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ matching: 9, total: 14, shown: 6, applicable: true }),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderBuilder(props: Partial<React.ComponentProps<typeof QueryBuilder>> = {}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <QueryBuilder type="PROJECT_LIST" value={EMPTY_QUERY} onChange={vi.fn()} {...props} />
      </QueryClientProvider>
    );
  }

  it('reports what will render against what exists', async () => {
    renderBuilder();
    // "Showing 6 of 14 projects" — the number that renders, not the number that matched.
    const readout = await screen.findByText(/Showing/);
    expect(within(readout).getByText('6')).toBeTruthy();
    expect(within(readout).getByText('14')).toBeTruthy();
  });

  it('says how many the limit is hiding, so a truncated list is not mistaken for a filter bug', async () => {
    renderBuilder();
    expect(await screen.findByText(/limit hides 3/)).toBeTruthy();
  });

  it('only offers sort fields the resolver accepts', () => {
    renderBuilder();
    const select = screen.getByLabelText(/sort by/i) as HTMLSelectElement;
    const offered = Array.from(select.options).map((o) => o.value);
    // Mirrors SORTABLE_FIELDS in resolve.service.ts — an unlisted field silently falls
    // back to the default sort, which reads as a styling bug.
    const allowed = ['order', 'navOrder', 'createdAt', 'updatedAt', 'name', 'title', 'issueDate', 'startDate', 'publishedAt', 'level'];
    for (const field of offered) expect(allowed).toContain(field);
  });

  it('warns when nothing matches instead of silently rendering an empty section', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ matching: 0, total: 14, shown: 0, applicable: true }),
      }))
    );
    renderBuilder();
    expect(await screen.findByText(/this section will render empty/i)).toBeTruthy();
  });

  it('surfaces a failed count rather than showing a stale or invented number', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    renderBuilder();
    await waitFor(() => expect(screen.getByText(/couldn’t load the result count/i)).toBeTruthy());
  });
});
