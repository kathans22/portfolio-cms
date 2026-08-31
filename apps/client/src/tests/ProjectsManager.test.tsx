import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectsManager from '../pages/admin/ProjectsManager';

function renderProjectsManager() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectsManager />
    </QueryClientProvider>
  );
}

function mockFetchImpl(url: string) {
  if (url.includes('/projects') && !url.includes('POST')) {
    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
}

describe('Admin ProjectsManager form', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => mockFetchImpl(url)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the add-project modal with all core fields', async () => {
    renderProjectsManager();

    fireEvent.click(await screen.findByRole('button', { name: /add project/i }));

    expect(screen.getByLabelText(/project title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/summary/i)).toBeInTheDocument();
  });

  it('shows validation errors when submitted with a too-short title', async () => {
    renderProjectsManager();

    fireEvent.click(await screen.findByRole('button', { name: /add project/i }));
    fireEvent.change(screen.getByLabelText(/project title/i), { target: { value: 'AB' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/title must be at least 3 characters/i)).toBeInTheDocument();
  });

  it('submits a POST to /projects with valid form data', async () => {
    renderProjectsManager();

    fireEvent.click(await screen.findByRole('button', { name: /add project/i }));

    fireEvent.change(screen.getByLabelText(/project title/i), { target: { value: 'Aura CMS Platform' } });
    fireEvent.change(screen.getByLabelText(/url slug/i), { target: { value: 'aura-cms-platform' } });
    fireEvent.change(screen.getByLabelText(/summary/i), { target: { value: 'A headless content management system.' } });
    fireEvent.change(screen.getByLabelText(/fallback description/i), {
      target: { value: 'A headless content management system with real-time editing.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
      const postCall = calls.find(([, options]) => options?.method === 'POST' && (options.body as string)?.includes('aura-cms-platform'));
      expect(postCall).toBeTruthy();
    });
  });
});
