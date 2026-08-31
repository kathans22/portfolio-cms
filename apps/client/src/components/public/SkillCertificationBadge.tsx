import React from 'react';
import { Link } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import type { SkillCertification } from '@portfolio/types';
import { BadgeCheck, ExternalLink } from 'lucide-react';

interface SkillCertificationBadgeProps {
  skillName: string;
  certifications: SkillCertification[];
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

// Renders nothing when a skill has no credential. Most skills won't have one, and an
// empty slot or a "not certified" label would make the ordinary case look like missing
// data — the row has to read as complete on its own.
export function SkillCertificationBadge({ skillName, certifications }: SkillCertificationBadgeProps) {
  if (certifications.length === 0) return null;

  // Server sorts issueDate descending, so the first is the most recent.
  const [primary] = certifications;
  const label =
    certifications.length === 1
      ? `${primary.name} certification from ${primary.issuingOrganization} — view details`
      : `${certifications.length} certifications for ${skillName} — view details`;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          title={certifications.length === 1 ? primary.name : `${certifications.length} certifications`}
          className="inline-flex items-center gap-1 align-middle rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
        >
          {primary.issuerLogoUrl ? (
            <img src={primary.issuerLogoUrl} alt="" loading="lazy" className="w-3.5 h-3.5 rounded-sm object-contain" />
          ) : (
            <BadgeCheck size={12} aria-hidden="true" />
          )}
          <span className="text-[9px] font-bold uppercase tracking-wide">
            {certifications.length === 1 ? 'Certified' : `${certifications.length} Certs`}
          </span>
        </button>
      </Popover.Trigger>

      {/* Radix handles Escape-to-dismiss, focus trapping and focus restore. Revealed
          in place: activating a badge mid-scan must not eject the visitor to a
          different route. */}
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <ul className="space-y-3">
            {certifications.map((cert) => (
              <li key={cert.id} className="border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                <div className="flex items-start gap-2">
                  {cert.issuerLogoUrl ? (
                    <img src={cert.issuerLogoUrl} alt="" loading="lazy" className="w-6 h-6 rounded object-contain bg-white shrink-0" />
                  ) : (
                    <BadgeCheck size={14} className="text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <Link
                      to={`/certifications#cert-${cert.id}`}
                      className="block text-xs font-semibold text-slate-900 dark:text-white leading-snug hover:underline"
                    >
                      {cert.name}
                    </Link>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{cert.issuingOrganization}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Issued {formatDate(cert.issueDate)}
                      {cert.neverExpires
                        ? ''
                        : cert.expiryDate
                          ? ` · ${cert.isExpired ? 'Expired' : 'Valid through'} ${formatDate(cert.expiryDate)}`
                          : ''}
                    </p>
                    {cert.credentialUrl && (
                      <a
                        href={cert.credentialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                      >
                        Verify credential <ExternalLink size={10} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Link
            to={`/certifications#cert-${primary.id}`}
            className="mt-3 block border-t border-slate-100 pt-3 text-[11px] font-semibold text-indigo-600 hover:underline dark:border-slate-800 dark:text-indigo-400"
          >
            View all certifications &rarr;
          </Link>

          <Popover.Arrow className="fill-white dark:fill-slate-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
