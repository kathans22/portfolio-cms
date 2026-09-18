import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiFetch } from '../../lib/api';
import { Seo } from '../../components/ui/Seo';
import { PROJECT_DOMAIN_META, ProjectDomain } from '@portfolio/shared';
import type { PublicCertification, Skill } from '@portfolio/types';
import { BadgeCheck, ExternalLink, AlertCircle, Calendar } from 'lucide-react';

const DOMAIN_OPTIONS = Object.entries(PROJECT_DOMAIN_META) as [ProjectDomain, { label: string; slug: string }][];
const UNGROUPED = 'OTHER';

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

export default function Certifications() {
  const [domainFilter, setDomainFilter] = useState<ProjectDomain | 'ALL'>('ALL');
  const location = useLocation();

  // Derived from the URL rather than stored, so arriving at #cert-<id> highlights on
  // the first render. State only records that the highlight has since faded.
  const hashId = location.hash.match(/^#cert-(.+)$/)?.[1] ?? null;
  const [fadedId, setFadedId] = useState<string | null>(null);
  const highlightedId = hashId && fadedId !== hashId ? hashId : null;

  const { data: certifications, isLoading, isError } = useQuery<PublicCertification[]>({
    queryKey: ['certifications'],
    queryFn: async () => (await apiFetch('/certifications')).json(),
  });

  // Names for the "covered skills" chips. The relation is stored on the certification,
  // so this is only a display lookup.
  const { data: skills } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: async () => (await apiFetch('/skills')).json(),
  });

  useEffect(() => {
    apiFetch('/analytics', { method: 'POST', body: JSON.stringify({ path: '/certifications' }) }).catch(() => {});
  }, []);

  const skillById = useMemo(() => new Map((skills ?? []).map((skill) => [skill.id, skill])), [skills]);

  const filtered = useMemo(() => {
    if (!certifications) return [];
    return certifications.filter((cert) => domainFilter === 'ALL' || cert.domains.includes(domainFilter));
  }, [certifications, domainFilter]);

  // Grouped into domain sections when showing everything; a single flat group once a
  // specific domain is selected, since the heading would just repeat the filter.
  const groups = useMemo(() => {
    if (domainFilter !== 'ALL') return [{ key: domainFilter, label: PROJECT_DOMAIN_META[domainFilter].label, items: filtered }];

    const byDomain = new Map<string, PublicCertification[]>();
    for (const cert of filtered) {
      const keys = cert.domains.length > 0 ? cert.domains : [UNGROUPED];
      for (const key of keys) {
        if (!byDomain.has(key)) byDomain.set(key, []);
        byDomain.get(key)!.push(cert);
      }
    }

    const ordered = DOMAIN_OPTIONS.map(([value, meta]) => ({ key: value as string, label: meta.label, items: byDomain.get(value) ?? [] }));
    if (byDomain.has(UNGROUPED)) {
      ordered.push({ key: UNGROUPED, label: 'Other', items: byDomain.get(UNGROUPED)! });
    }
    return ordered.filter((group) => group.items.length > 0);
  }, [filtered, domainFilter]);

  // Deep link from a skill badge (/certifications#cert-<id>): scroll the card into
  // view, then let the highlight fade. The only setState here runs inside the timeout,
  // so it never cascades a render synchronously from the effect body.
  useEffect(() => {
    if (!hashId || !certifications) return;

    const element = document.getElementById(`cert-${hashId}`);
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setFadedId(hashId), 2200);
    return () => clearTimeout(timer);
  }, [hashId, certifications]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" role="status" aria-label="Loading certifications" />
      </div>
    );
  }

  if (isError || !certifications) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-4">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold mb-2">Failed to load certifications</h2>
      </div>
    );
  }

  return (
    <div className="container-wide pt-32 pb-24 text-slate-700 dark:text-slate-100 min-h-screen">
      <Seo title="Certifications" description="Third-party credentials and the skills they validate." path="/certifications" />

      <h1 className="text-3xl md:text-5xl font-extrabold mb-4 text-slate-900 dark:text-white">Certifications</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-10">
        Independently issued credentials, with the skills each one actually covers.
      </p>

      <div className="flex flex-wrap gap-3 mb-12" role="group" aria-label="Filter certifications">
        <label className="sr-only" htmlFor="cert-domain-filter">Filter by domain</label>
        <select
          id="cert-domain-filter"
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value as ProjectDomain | 'ALL')}
          className="form-input w-auto"
        >
          <option value="ALL">All domains</option>
          {DOMAIN_OPTIONS.map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </select>
      </div>

      {groups.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400 text-center py-16">No certifications to show yet.</p>
      )}

      <div className="space-y-14">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`cert-group-${group.key}`}>
            <h2 id={`cert-group-${group.key}`} className="text-xl font-bold text-slate-900 dark:text-white mb-6">
              {group.label}
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {group.items.map((cert, i) => (
                <motion.article
                  key={cert.id}
                  id={`cert-${cert.id}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className={`scroll-mt-28 rounded-xl border p-6 flex flex-col transition-shadow duration-500 ${
                    highlightedId === cert.id
                      ? 'border-indigo-500 ring-2 ring-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/5'
                      : 'border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    {cert.issuerLogoUrl ? (
                      <img src={cert.issuerLogoUrl} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-contain bg-white p-1 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <BadgeCheck className="text-indigo-500" size={22} aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">{cert.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{cert.issuingOrganization}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-4">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={12} aria-hidden="true" /> Issued {formatDate(cert.issueDate)}
                    </span>
                    {cert.neverExpires ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">No expiry</span>
                    ) : cert.isExpired ? (
                      // Deliberately neutral, never alarming — a lapsed credential is
                      // still evidence the work was done.
                      <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                        Expired {formatDate(cert.expiryDate)}
                      </span>
                    ) : cert.expiryDate ? (
                      <span>Valid through {formatDate(cert.expiryDate)}</span>
                    ) : null}
                  </div>

                  {cert.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{cert.description}</p>
                  )}

                  {cert.skillIds.length > 0 && (
                    <div className="mb-4">
                      <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold block mb-2">Validates</span>
                      <div className="flex flex-wrap gap-1.5">
                        {cert.skillIds.map((skillId) => {
                          const skill = skillById.get(skillId);
                          if (!skill) return null;
                          return (
                            // Links to the skill it validates on the home page's skill
                            // grid — the badge on that skill links here, closing the loop.
                            <Link
                              key={skillId}
                              to={`/#skill-${skillId}`}
                              className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-1 rounded-md transition-colors"
                            >
                              {skill.name}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-3 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 font-mono truncate">
                      {cert.credentialId ? `ID: ${cert.credentialId}` : ''}
                    </span>
                    {cert.credentialUrl && (
                      <a
                        href={cert.credentialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Verify ${cert.name} credential (opens in a new tab)`}
                        className="inline-flex items-center gap-1.5 shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                      >
                        Verify <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </motion.article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
