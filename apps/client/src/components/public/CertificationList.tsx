import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { PublicCertification } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { BadgeCheck } from 'lucide-react';

interface CertificationListProps {
  /** "compact" is the single-row logo strip for the home page. */
  layoutVariant?: 'compact';
  limit?: number;
}

// Recruiters scan the home page first, so credentials belong in that first screenful
// rather than three routes deep. Deliberately capped and logo-led: this is a signal
// that evidence exists, not the evidence itself — that lives on /certifications.
export function CertificationList({ layoutVariant = 'compact', limit = 6 }: CertificationListProps) {
  const { data: certifications } = useQuery<PublicCertification[]>({
    queryKey: ['certifications'],
    queryFn: async () => (await apiFetch('/certifications')).json(),
  });

  const shown = (certifications ?? []).slice(0, limit);
  if (shown.length === 0) return null;

  // Only one variant exists today; the prop keeps the call site honest about which
  // layout it's asking for rather than the component guessing from context.
  if (layoutVariant !== 'compact') return null;

  return (
    <section aria-labelledby="home-certifications" className="container-wide py-10 border-t border-slate-200 dark:border-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 id="home-certifications" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Certified by
        </h2>
        <Link to="/certifications" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold text-sm">
          All certifications &rarr;
        </Link>
      </div>

      <ul className="flex flex-wrap items-center gap-3">
        {shown.map((cert) => (
          <li key={cert.id}>
            <Link
              to={`/certifications#cert-${cert.id}`}
              // The name is always in the accessible name, not hover-only — hover is
              // a progressive nicety, never the sole way to read the credential.
              aria-label={`${cert.name} — ${cert.issuingOrganization}`}
              className="group flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 hover:border-indigo-400 dark:hover:border-indigo-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
            >
              {cert.issuerLogoUrl ? (
                <img src={cert.issuerLogoUrl} referrerPolicy="no-referrer" alt="" loading="lazy" className="w-7 h-7 rounded object-contain bg-white p-0.5 shrink-0" />
              ) : (
                <span className="w-7 h-7 rounded bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <BadgeCheck size={15} className="text-indigo-500" aria-hidden="true" />
                </span>
              )}

              {/* Without a logo, an icon-only tile says nothing — fall back to the
                  issuer name so the strip stays scannable whatever the data holds. */}
              {!cert.issuerLogoUrl && (
                <span className="whitespace-nowrap text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:hidden group-focus-visible:hidden">
                  {cert.issuingOrganization}
                </span>
              )}

              <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold text-slate-700 dark:text-slate-200 opacity-0 transition-all duration-300 group-hover:max-w-[16rem] group-hover:opacity-100 group-focus-visible:max-w-[16rem] group-focus-visible:opacity-100">
                {cert.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
