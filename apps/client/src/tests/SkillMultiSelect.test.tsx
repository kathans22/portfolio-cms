import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SkillMultiSelect } from '../components/admin/SkillMultiSelect';

const SKILLS = [
  { id: 'a1', name: 'Docker', category: 'Tools', domains: [], level: 4, hideLevel: false, order: 1 },
  { id: 'b2', name: 'Python', category: 'ML/AI', domains: [], level: 5, hideLevel: false, order: 2 },
  { id: 'c3', name: 'Python', category: 'Data', domains: [], level: 3, hideLevel: false, order: 3 },
];

function renderPicker(value: string[] = [], onChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SkillMultiSelect value={value} onChange={onChange} />
    </QueryClientProvider>
  );
  return { onChange };
}

describe('SkillMultiSelect', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options?: RequestInit) => {
        if (options?.method === 'POST') {
          return { ok: true, status: 201, json: async () => ({ id: 'new1', name: 'Kubernetes', category: 'Tools' }) };
        }
        return { ok: true, status: 200, json: async () => SKILLS };
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows each skill category as secondary text to disambiguate same-named skills', async () => {
    renderPicker();

    await waitFor(() => expect(screen.getAllByText('Python')).toHaveLength(2));
    // Two skills share the name "Python"; the category is what tells them apart.
    expect(screen.getByText('ML/AI')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('filters by category as well as by name', async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByText('Docker')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/search skills/i), { target: { value: 'ML/AI' } });

    expect(screen.getAllByText('Python')).toHaveLength(1);
    expect(screen.queryByText('Docker')).not.toBeInTheDocument();
  });

  it('says nothing alarming when no skills are mapped — that is the normal case', async () => {
    renderPicker([]);
    await waitFor(() => expect(screen.getByText(/no skills mapped — this is fine and common/i)).toBeInTheDocument());
  });

  it('stays silent at six mapped skills', async () => {
    renderPicker(['1', '2', '3', '4', '5', '6']);
    await waitFor(() => expect(screen.getByText(/6 skills mapped/i)).toBeInTheDocument());

    expect(screen.queryByText(/can weaken its signal/i)).not.toBeInTheDocument();
  });

  it('warns — without blocking — once more than six skills are mapped', async () => {
    renderPicker(['1', '2', '3', '4', '5', '6', '7']);

    await waitFor(() =>
      expect(screen.getByText(/Mapping many skills to one credential can weaken its signal/i)).toBeInTheDocument()
    );
    // The warning renders independently of the skill list, so wait for the list too
    // before asserting nothing in it got disabled.
    await waitFor(() => expect(screen.getByText('Docker')).toBeInTheDocument());

    // Advisory only: nothing is disabled and no confirmation gate appears.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).not.toBeDisabled();
    }
  });

  it('creates a skill inline and selects it without leaving the form', async () => {
    const { onChange } = renderPicker(['a1']);
    await waitFor(() => expect(screen.getByText('Docker')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /create new skill/i }));

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Kubernetes' } });
    fireEvent.change(screen.getByLabelText(/^category$/i), { target: { value: 'Tools' } });
    fireEvent.click(screen.getByRole('button', { name: /create & select/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['a1', 'new1']));
  });

  it('cannot submit the enclosing certification form — every modal control is type=button', async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByText('Docker')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /create new skill/i }));

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('type', 'button');
    }
  });

  it('blocks creation until both name and category are supplied', async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByText('Docker')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /create new skill/i }));
    const submit = screen.getByRole('button', { name: /create & select/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Kubernetes' } });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^category$/i), { target: { value: 'Tools' } });
    expect(submit).not.toBeDisabled();
  });
});
