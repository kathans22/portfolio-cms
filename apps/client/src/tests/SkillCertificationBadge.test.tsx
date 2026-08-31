import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SkillCertification } from '@portfolio/types';
import { SkillCertificationBadge } from '../components/public/SkillCertificationBadge';

function cert(overrides: Partial<SkillCertification> = {}): SkillCertification {
  return {
    id: 'cert-1',
    name: 'AWS Certified Solutions Architect',
    issuingOrganization: 'Amazon Web Services',
    issueDate: '2025-03-14T00:00:00.000Z',
    expiryDate: null,
    neverExpires: true,
    isExpired: false,
    ...overrides,
  };
}

function renderBadge(certifications: SkillCertification[], skillName = 'Docker') {
  return render(
    <MemoryRouter>
      <SkillCertificationBadge skillName={skillName} certifications={certifications} />
    </MemoryRouter>
  );
}

describe('SkillCertificationBadge', () => {
  it('renders nothing at all for an uncertified skill — no placeholder', () => {
    const { container } = renderBadge([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes a descriptive accessible name naming the credential and issuer', () => {
    renderBadge([cert()]);

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAccessibleName(
      'AWS Certified Solutions Architect certification from Amazon Web Services — view details'
    );
  });

  it('summarises the count when a skill has several credentials', () => {
    renderBadge([cert(), cert({ id: 'cert-2', name: 'CKA' })]);

    expect(screen.getByRole('button')).toHaveAccessibleName('2 certifications for Docker — view details');
  });

  it('is a native, keyboard-focusable button so Enter and Space activate it', () => {
    renderBadge([cert()]);
    const trigger = screen.getByRole('button');

    // A real <button> is what makes keyboard activation work without extra handlers.
    // jsdom doesn't synthesize click-from-Enter the way browsers do, so assert the
    // property that guarantees it rather than the browser behaviour jsdom lacks.
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).not.toHaveAttribute('disabled');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    trigger.focus();
    expect(trigger).toHaveFocus();
  });

  it('marks the trigger expanded once the popover is open', async () => {
    renderBadge([cert()]);
    const trigger = screen.getByRole('button');

    fireEvent.click(trigger);

    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
  });

  it('reveals credential detail in place, including a verify link that is safe to open', async () => {
    renderBadge([cert({ credentialUrl: 'https://example.com/verify' })]);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByText('Amazon Web Services')).toBeInTheDocument());

    const verify = screen.getByRole('link', { name: /verify credential/i });
    expect(verify).toHaveAttribute('href', 'https://example.com/verify');
    expect(verify).toHaveAttribute('target', '_blank');
    expect(verify).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(verify).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('omits the verify link when the credential has no public verification URL', async () => {
    renderBadge([cert()]);

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('Amazon Web Services')).toBeInTheDocument());

    expect(screen.queryByRole('link', { name: /verify credential/i })).not.toBeInTheDocument();
  });

  it('deep-links to the credential on the certifications page', async () => {
    renderBadge([cert({ id: 'abc123' })]);

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('Amazon Web Services')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: /view all certifications/i })).toHaveAttribute(
      'href',
      '/certifications#cert-abc123'
    );
  });

  it('lists every credential when a skill maps to more than one', async () => {
    renderBadge([cert({ id: 'a', name: 'Newer Cert' }), cert({ id: 'b', name: 'Older Cert' })]);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByText('Newer Cert')).toBeInTheDocument());
    expect(screen.getByText('Older Cert')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    renderBadge([cert()]);

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('labels a lapsed credential as expired rather than presenting it as current', async () => {
    renderBadge([
      cert({ neverExpires: false, expiryDate: '2021-01-01T00:00:00.000Z', isExpired: true }),
    ]);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByText(/Expired Jan 2021/)).toBeInTheDocument());
  });
});
