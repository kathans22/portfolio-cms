import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import type { PublicResume, Experience, Education } from '@portfolio/types';
import { apiFetch, API_BASE } from '../../lib/api';
import { Seo } from '../../components/ui/Seo';
import { Download, FileText, Maximize2, Briefcase, GraduationCap, UserRound, ArrowDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const FILE_URL = `${API_BASE}/resume/file`;
const DOWNLOAD_URL = `${API_BASE}/resume/download`;
const NAME = 'Kathan Shah';

/**
 * Professional summary — taken verbatim from the résumé PDF so the page and the
 * document can never disagree. Edit here (and in the PDF) together.
 *
 * Not CMS-managed yet: /about is a hardcoded route, not a Page document. If this
 * needs to change without a deploy it wants a singleton content field in admin.
 */
const SUMMARY =
  'Full Stack Developer with 1+ years of experience building enterprise ERP platforms ' +
  'and a multi-tenant e-commerce solution handling 1.4M+ orders and 30,000+ products. ' +
  'Skilled in Node.js, PostgreSQL, SQL optimization, ETL/ELT pipelines, and RESTful API ' +
  'development across high-volume transactional workloads.';

function fmtMonth(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
};

/** Numbered kicker + icon + title, so the four sections read as one sequence. */
function SectionHeading({
  icon: Icon,
  accent,
  kicker,
  children,
}: {
  icon: LucideIcon;
  accent: 'indigo' | 'emerald';
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <span className="kicker flex items-center gap-2.5">
        <span className={`h-px w-8 ${accent === 'indigo' ? 'bg-indigo-400/60' : 'bg-emerald-400/60'}`} />
        {kicker}
      </span>
      <h2 className="mt-3 flex items-center gap-2.5 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
        <Icon size={22} className={accent === 'indigo' ? 'text-indigo-500' : 'text-emerald-500'} />
        {children}
      </h2>
    </div>
  );
}

/**
 * One role in the experience grid.
 *
 * Cards are grid items, so they all stretch to the tallest in the row — the ghosted
 * ordinal is anchored to the bottom rather than following the text, which keeps that
 * corner mark on a shared baseline no matter how many lines a job title wraps to.
 */
function RoleCard({
  index,
  role,
  company,
  when,
  isCurrent,
}: {
  index: number;
  role: string;
  company: string;
  when: string;
  isCurrent?: boolean;
}) {
  // The newest role carries a permanent accent rail and a faint warm wash, so the
  // eye lands on it first without needing a label to say "most recent".
  const isLatest = index === 0;

  return (
    <li
      className={`group relative flex min-h-[10.5rem] flex-col overflow-hidden rounded-xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift ${
        isLatest
          ? 'border-indigo-200 bg-gradient-to-b from-indigo-50/70 to-slate-50 hover:border-indigo-300 dark:border-indigo-900/60 dark:from-indigo-950/25 dark:to-slate-900/40 dark:hover:border-indigo-800'
          : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:border-slate-700'
      }`}
    >
      {/* accent rail: always drawn on the newest role, drawn on hover for the rest */}
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 to-emerald-500 transition-[width] duration-500 ease-out group-hover:w-full ${
          isLatest ? 'w-full' : 'w-0'
        }`}
      />

      {/* editorial ordinal, bled into the card's bottom-right corner */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-5 -right-1 font-heading text-7xl font-bold leading-none text-slate-900/[0.035] dark:text-white/[0.05]"
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${isCurrent ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
        {when}
      </span>

      <h3 className="relative mt-4 text-[17px] font-bold leading-snug tracking-tight text-slate-900 dark:text-white">
        {role}
      </h3>

      <div className="relative mt-auto pt-4">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{company}</p>
        {isCurrent && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            <span className="h-1 w-1 rounded-full bg-emerald-500" /> Current
          </span>
        )}
      </div>
    </li>
  );
}

function TimelineItem({
  when,
  title,
  subtitle,
  body,
  accent,
}: {
  when: string;
  title: string;
  subtitle: string;
  body?: string;
  accent: 'indigo' | 'emerald';
}) {
  return (
    // Entries without a body are two short lines, so they get tighter spacing —
    // the roomier rhythm only earns its space when there's prose to separate.
    <li className={`relative pl-7 last:pb-0 ${body ? 'pb-10' : 'pb-7'}`}>
      <span
        className={`absolute -left-[7px] top-1 h-[14px] w-[14px] rounded-full border-2 bg-slate-50 dark:bg-slate-950 ${
          accent === 'indigo' ? 'border-indigo-500' : 'border-emerald-500'
        }`}
      />
      <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{when}</span>
      <h3 className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
      {body && <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>}
    </li>
  );
}

export default function About() {
  const { data: resume, isLoading: resumeLoading } = useQuery<PublicResume | null>({
    queryKey: ['publicResume'],
    queryFn: async () => {
      const res = await apiFetch('/resume');
      return res.ok ? res.json() : null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: experience } = useQuery<Experience[]>({
    queryKey: ['experience'],
    queryFn: async () => (await apiFetch('/experience')).json(),
  });

  const { data: education } = useQuery<Education[]>({
    queryKey: ['education'],
    queryFn: async () => (await apiFetch('/education')).json(),
  });

  useEffect(() => {
    apiFetch('/analytics', { method: 'POST', body: JSON.stringify({ path: '/about' }) }).catch(() => {});
  }, []);

  const exp = [...(experience ?? [])].sort((a, b) => a.order - b.order);
  const edu = [...(education ?? [])].sort((a, b) => a.order - b.order);
  const hasTimeline = exp.length > 0 || edu.length > 0;

  return (
    <div className="min-h-screen text-slate-700 dark:text-slate-100">
      <Seo title="Résumé" description={`${NAME} — résumé, work experience and education.`} path="/about" />

      <div className="container-wide pt-32 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-end justify-between gap-5"
        >
          <div>
            <span className="kicker">Résumé</span>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">{NAME}</h1>
            {resume?.updatedAt && (
              <p className="mt-3 font-mono text-xs text-slate-400 dark:text-slate-500">
                Updated {new Date(resume.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
              </p>
            )}
          </div>

          {resume && (
            <div className="flex flex-wrap gap-3">
              {/* Same-page anchor, so it uses the smooth scroll and the 6rem
                  scroll-padding already set globally for the fixed header. */}
              <a href="#resume" className="btn-ghost">
                <ArrowDown size={15} /> Jump to résumé
              </a>
              <a href={resume.embedUrl ?? FILE_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                <Maximize2 size={15} /> Full screen
              </a>
              <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
                <Download size={16} /> Download PDF
              </a>
            </div>
          )}
        </motion.div>
      </div>

      {/* 1 — Professional summary. */}
      <motion.section {...fadeInUp} className="container-wide border-t border-slate-200 py-16 dark:border-slate-900">
        <SectionHeading icon={UserRound} accent="indigo" kicker="01 / Profile">
          Professional summary
        </SectionHeading>

        <p className="max-w-3xl text-lg leading-relaxed text-slate-600 dark:text-slate-300 sm:text-xl">
          {SUMMARY}
        </p>
      </motion.section>

      {/* 2 — Education. */}
      {edu.length > 0 && (
        <motion.section {...fadeInUp} className="container-wide border-t border-slate-200 py-16 dark:border-slate-900">
          <SectionHeading icon={GraduationCap} accent="emerald" kicker="02 / Education">
            Education
          </SectionHeading>
          <ol className="ml-1.5 max-w-3xl border-l border-slate-200 dark:border-slate-800">
            {edu.map((item) => (
              <TimelineItem
                key={item.id}
                accent="emerald"
                when={`${fmtMonth(item.startDate)} — ${fmtMonth(item.endDate)}`}
                title={item.degree}
                subtitle={item.institution}
                body={item.description}
              />
            ))}
          </ol>
        </motion.section>
      )}

      {/* 3 — Work experience. */}
      {exp.length > 0 && (
        <motion.section {...fadeInUp} className="container-wide border-t border-slate-200 py-16 dark:border-slate-900">
          <SectionHeading icon={Briefcase} accent="indigo" kicker="03 / Experience">
            Work experience
          </SectionHeading>
          {/* A grid, not a vertical timeline: roles flow left-to-right and wrap onto a
              new row, so adding a company widens the story rather than lengthening the
              page. Role, employer and dates only — the detail lives in the résumé PDF
              below, and `description` stays stored and editable in admin regardless. */}
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {exp.map((item, i) => (
              <RoleCard
                key={item.id}
                index={i}
                role={item.role}
                company={item.company}
                when={`${fmtMonth(item.startDate)} — ${item.isCurrent ? 'Present' : fmtMonth(item.endDate)}`}
                isCurrent={item.isCurrent}
              />
            ))}
          </ol>
        </motion.section>
      )}

      {/* 4 — The full document. No scroll-mt here: `html` already carries
          `scroll-padding-top: 6rem` for the fixed header, and adding scroll-margin on
          top of it lands the anchor ~190px down instead of ~96px. */}
      <motion.section
        {...fadeInUp}
        id="resume"
        className="container-wide border-t border-slate-200 py-16 dark:border-slate-900"
      >
        {/* items-baseline, not items-end: SectionHeading carries its own bottom
            margin, which items-end would push the download link down by. */}
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <SectionHeading icon={FileText} accent="indigo" kicker={hasTimeline ? '04 / Document' : '02 / Document'}>
            {hasTimeline ? 'Full résumé' : 'Résumé'}
          </SectionHeading>
          {resume && (
            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs uppercase tracking-widest text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Download PDF ↓
            </a>
          )}
        </div>

        {resumeLoading ? (
          <div className="h-[80vh] w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        ) : resume ? (
          <div
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-soft dark:border-slate-800 dark:bg-slate-900${
              resume.embedUrl ? ' p-3 sm:p-6' : ''
            }`}
          >
            {resume.embedUrl ? (
              <iframe
                title={`${NAME} résumé`}
                src={resume.embedUrl}
                className="h-[85vh] w-full rounded-lg border-0"
              />
            ) : (
              <object data={FILE_URL} type="application/pdf" className="h-[85vh] w-full" aria-label={`${NAME} résumé`}>
                <iframe title={`${NAME} résumé`} src={FILE_URL} className="h-[85vh] w-full border-0" />
              </object>
            )}
          </div>
        ) : (
          <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-16 text-center dark:border-slate-700">
            <FileText size={40} className="mb-4 opacity-30" />
            <p className="text-slate-500 dark:text-slate-400">The résumé PDF isn&apos;t published yet.</p>
          </div>
        )}
      </motion.section>
    </div>
  );
}
