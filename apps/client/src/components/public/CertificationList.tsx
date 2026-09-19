import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { PublicCertification } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { BadgeCheck, ChevronDown } from 'lucide-react';

interface CertificationListProps {
  /** "compact" is the single-row issuer strip for the home page. */
  layoutVariant?: 'compact';
  /** Max number of distinct issuers shown. */
  limit?: number;
}

interface IssuerGroup {
  name: string;
  logoUrl?: string;
  certifications: PublicCertification[];
}

/**
 * One group per issuing organisation, in the order each issuer first appears. Issuers
 * are matched case-insensitively so "Udemy" and "udemy " don't become two tiles.
 */
export function groupByIssuer(certifications: PublicCertification[]): IssuerGroup[] {
  const groups = new Map<string, IssuerGroup>();
  for (const cert of certifications) {
    const key = cert.issuingOrganization.trim().toLowerCase();
    const group = groups.get(key);
    if (group) {
      group.certifications.push(cert);
      group.logoUrl ??= cert.issuerLogoUrl;
    } else {
      groups.set(key, {
        name: cert.issuingOrganization.trim(),
        logoUrl: cert.issuerLogoUrl,
        certifications: [cert],
      });
    }
  }
  return [...groups.values()];
}

function IssuerTile({ group }: { group: IssuerGroup }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const count = group.certifications.length;

  // Tap-to-open must also close on an outside tap or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        // Focus alone also opens the popover, so Escape has to release it too.
        if (ref.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <li ref={ref} className="group relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors hover:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-indigo-500/60"
      >
        {group.logoUrl ? (
          <img src={group.logoUrl} referrerPolicy="no-referrer" alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded bg-white object-contain p-0.5" />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-indigo-500/10">
            <BadgeCheck size={15} className="text-indigo-500" aria-hidden="true" />
          </span>
        )}
        {/* The issuer name is always visible: distinct names are what make this strip scannable. */}
        <span className="whitespace-nowrap text-sm font-semibold text-slate-700 dark:text-slate-200">{group.name}</span>
        {count > 1 && (
          <span
            className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400"
            aria-label={`${count} certifications`}
          >
            ×{count}
          </span>
        )}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : 'group-hover:rotate-180'}`}
        />
      </button>

      {/* Opens on hover and keyboard focus (desktop) or tap (touch). The links stay in
          the DOM either way, so a screen reader can always reach them. */}
      <div
        className={`absolute left-0 top-full z-20 w-72 max-w-[85vw] pt-2 transition duration-150 ${
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible -translate-y-1 opacity-0 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100'
        }`}
      >
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-float dark:border-slate-700 dark:bg-slate-900">
          <p className="px-2 pb-1 pt-1 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            {count === 1 ? 'Certification' : `${count} certifications`}
          </p>
          <ul>
            {group.certifications.map((cert) => (
              <li key={cert.id}>
                <Link
                  to={`/certifications#cert-${cert.id}`}
                  className="block rounded-lg px-2 py-2 text-sm font-medium leading-snug text-slate-700 hover:bg-indigo-500/10 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-200 dark:hover:text-indigo-300"
                >
                  {cert.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

// Recruiters scan the home page first, so credentials belong in that first screenful
// rather than three routes deep. One tile per issuer keeps it short however many
// courses were taken there; the individual names are one hover or tap away, and the
// full evidence lives on /certifications.
export function CertificationList({ layoutVariant = 'compact', limit = 6 }: CertificationListProps) {
  const { data: certifications } = useQuery<PublicCertification[]>({
    queryKey: ['certifications'],
    queryFn: async () => (await apiFetch('/certifications')).json(),
  });

  const groups = groupByIssuer(certifications ?? []).slice(0, limit);
  if (groups.length === 0) return null;

  // Only one variant exists today; the prop keeps the call site honest about which
  // layout it's asking for rather than the component guessing from context.
  if (layoutVariant !== 'compact') return null;

  return (
    <section aria-labelledby="home-certifications" className="container-wide border-t border-slate-200 py-10 dark:border-slate-900">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 id="home-certifications" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Certified by
        </h2>
        <Link to="/certifications" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          All certifications &rarr;
        </Link>
      </div>

      <ul className="flex flex-wrap items-start gap-3">
        {groups.map((group) => (
          <IssuerTile key={group.name.toLowerCase()} group={group} />
        ))}
      </ul>
    </section>
  );
}
