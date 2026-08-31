import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiFetch } from '../../lib/api';
import { Seo } from '../../components/ui/Seo';
import { Briefcase, BookOpen, Calendar, Award } from 'lucide-react';
import { PROJECT_DOMAIN_META, ProjectDomain } from '@portfolio/shared';
import type { Experience, Education, Skill } from '@portfolio/types';
import { SkillCertificationBadge } from '../../components/public/SkillCertificationBadge';

const DOMAIN_OPTIONS = Object.entries(PROJECT_DOMAIN_META) as [ProjectDomain, { label: string; slug: string }][];

function DomainBadges({ domains }: { domains: ProjectDomain[] }) {
  if (!domains?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {domains.map((d) => (
        <span key={d} className="bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
          {PROJECT_DOMAIN_META[d]?.label ?? d}
        </span>
      ))}
    </div>
  );
}

export default function About() {
  const [skillsDomainFilter, setSkillsDomainFilter] = useState<ProjectDomain | 'ALL'>('ALL');

  const { data: experiences } = useQuery<Experience[]>({
    queryKey: ['experience'],
    queryFn: async () => (await apiFetch('/experience')).json(),
  });

  const { data: educations } = useQuery<Education[]>({
    queryKey: ['education'],
    queryFn: async () => (await apiFetch('/education')).json(),
  });

  const { data: skills } = useQuery<Skill[]>({
    queryKey: ['skills', 'withCertifications'],
    // Opt in to the certification join — this page renders credential badges.
    queryFn: async () => (await apiFetch('/skills?withCertifications=true')).json(),
  });

  useEffect(() => {
    apiFetch('/analytics', {
      method: 'POST',
      body: JSON.stringify({ path: '/about' }),
    }).catch(() => {});
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const filteredSkills = useMemo(() => {
    if (!skills) return [];
    return skillsDomainFilter === 'ALL' ? skills : skills.filter((s) => s.domains.includes(skillsDomainFilter));
  }, [skills, skillsDomainFilter]);

  const skillsByCategory = useMemo(() => {
    return filteredSkills.reduce((acc: Record<string, Skill[]>, skill) => {
      if (!acc[skill.category]) acc[skill.category] = [];
      acc[skill.category].push(skill);
      return acc;
    }, {});
  }, [filteredSkills]);

  return (
    <div className="max-w-4xl mx-auto px-6 pt-32 pb-24 text-slate-700 dark:text-slate-100 min-h-screen">
      <Seo title="About" description="Bio, experience, education, and technical skills." path="/about" />

      <h1 className="text-3xl md:text-5xl font-extrabold mb-8 text-slate-900 dark:text-white">About Me</h1>
      <div className="space-y-6 text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base mb-16">
        <p>
          Hello! I&apos;m <strong className="text-slate-900 dark:text-white">Kathan</strong>, a full-stack engineer and solutions architect based in San Francisco, CA. I build high-performance web applications that bridge clean user experience design with robust backend microservices.
        </p>
        <p>
          Over the past 6+ years, I have engineered server frameworks for analytics platforms, scaled document-oriented database structures using MongoDB and Mongoose, and constructed interactive editor interfaces in React.
        </p>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white pt-6">Principles I Follow</h2>
        <ul className="list-disc list-inside space-y-2 text-slate-500 dark:text-slate-400 pl-2">
          <li><strong className="text-slate-700 dark:text-slate-300">Clean Type Architectures</strong>: Leveraging TypeScript compiler checks to eliminate runtime bugs early.</li>
          <li><strong className="text-slate-700 dark:text-slate-300">Performance Budgets</strong>: Constructing small bundles, caching requests via TanStack Query, and lazy-loading visual components.</li>
          <li><strong className="text-slate-700 dark:text-slate-300">Scalable Document Design</strong>: Structuring embedded vs. referenced data and indexing for real query patterns.</li>
        </ul>
      </div>

      {/* Timeline */}
      <div className="grid md:grid-cols-2 gap-12 mb-16">
        <section aria-labelledby="work-history-heading">
          <h2 id="work-history-heading" className="text-2xl font-bold mb-8 flex items-center gap-3 text-slate-900 dark:text-white">
            <Briefcase className="text-indigo-500" /> Work History
          </h2>
          <ol className="border-l border-slate-200 dark:border-slate-800 pl-6 ml-3 space-y-10 relative">
            {experiences?.map((exp) => (
              <li key={exp.id} className="relative">
                <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-500 bg-white dark:bg-slate-950 ${exp.isCurrent ? 'ring-4 ring-indigo-500/20' : ''}`} />
                <span className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold flex items-center gap-1.5 mb-2">
                  <Calendar size={12} /> {formatDate(exp.startDate)} — {exp.isCurrent ? 'Present' : formatDate(exp.endDate)}
                </span>
                <DomainBadges domains={exp.domains} />
                <h3 className="text-lg font-bold mb-1 text-slate-900 dark:text-white">{exp.role}</h3>
                <h4 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-3">{exp.company}</h4>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{exp.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="education-heading">
          <h2 id="education-heading" className="text-2xl font-bold mb-8 flex items-center gap-3 text-slate-900 dark:text-white">
            <BookOpen className="text-emerald-500" /> Education
          </h2>
          <ol className="border-l border-slate-200 dark:border-slate-800 pl-6 ml-3 space-y-10 relative">
            {educations?.map((edu) => (
              <li key={edu.id} className="relative">
                <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-emerald-500 bg-white dark:bg-slate-950" />
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 mb-2">
                  <Calendar size={12} /> {formatDate(edu.startDate)} — {formatDate(edu.endDate)}
                </span>
                <h3 className="text-lg font-bold mb-1 text-slate-900 dark:text-white">{edu.degree}</h3>
                <h4 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{edu.institution}</h4>
                {edu.description && <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mt-2">{edu.description}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Skills */}
      <section aria-labelledby="skills-heading">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <h2 id="skills-heading" className="text-2xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
            <Award className="text-indigo-500" /> Skills
          </h2>
          <div>
            <label className="sr-only" htmlFor="skills-domain-filter">Filter skills by domain</label>
            <select
              id="skills-domain-filter"
              value={skillsDomainFilter}
              onChange={(e) => setSkillsDomainFilter(e.target.value as ProjectDomain | 'ALL')}
              className="form-input w-auto"
            >
              <option value="ALL">All domains</option>
              {DOMAIN_OPTIONS.map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {Object.entries(skillsByCategory).map(([category, list]) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-6 rounded-xl"
            >
              <h3 className="text-sm font-bold mb-5 text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">{category}</h3>
              <div className="space-y-4">
                {list.map((skill) => (
                  // Anchor target for the "covered skills" chips on /certifications,
                  // closing the loop in both directions.
                  <div key={skill.id} id={`skill-${skill.id}`} className="scroll-mt-28">
                    <div className="flex justify-between items-center gap-2 text-sm mb-1.5 font-medium">
                      <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{skill.name}</span>
                        <SkillCertificationBadge skillName={skill.name} certifications={skill.certifications ?? []} />
                      </span>
                      {!skill.hideLevel && (
                        <span className="text-slate-500 dark:text-slate-400 text-xs shrink-0" aria-label={`Level ${skill.level} of 5`}>{skill.level}/5</span>
                      )}
                    </div>
                    {/* Self-rating suppressed where a credential speaks for itself, so the
                        stronger signal isn't visually competing with the weaker one. */}
                    {!skill.hideLevel && (
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${(skill.level / 5) * 100}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
          {Object.keys(skillsByCategory).length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 col-span-full text-center py-8">No skills match this filter.</p>
          )}
        </div>
      </section>
    </div>
  );
}
