import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import Contact from '../pages/public/Contact';

function renderContact() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter>
          <Contact />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

describe('Contact page form', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => ({}),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders all form fields', () => {
    renderContact();

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitted empty', async () => {
    renderContact();

    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/name must be at least 2 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/message must be at least 10 characters/i)).toBeInTheDocument();
  });

  it('submits a POST to /contact with the form data on valid input', async () => {
    renderContact();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Freelance work' } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'I would like to discuss a project.' } });

    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
      const contactCall = calls.find(([url]) => url.includes('/contact'));
      expect(contactCall).toBeTruthy();
    });

    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    const contactCall = calls.find(([url]) => url.includes('/contact'));
    const body = JSON.parse(contactCall![1].body as string);
    expect(body.name).toBe('Jane Doe');
    expect(body.email).toBe('jane@example.com');
    expect(body.message).toBe('I would like to discuss a project.');
  });
});
