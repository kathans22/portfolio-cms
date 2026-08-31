import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiFetch } from '../../lib/api';
import { Seo } from '../../components/ui/Seo';
import { Github, ExternalLink, AlertCircle } from 'lucide-react';
import { PROJECT_DOMAIN_META, ProjectDomain } from '@portfolio/shared';
import type { Project } from '@portfolio/types';

const DOMAIN_OPTIONS = Object.entries(PROJECT_DOMAIN_META) as [ProjectDomain, { label: string; slug: string }][];

export default function Projects() {
  const [domainFilter, setDomainFilter] = useState<ProjectDomain | 'ALL'>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');

  const { data: projects, isLoading, isError } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiFetch('/projects');
      return res.json();
    }
  });

  useEffect(() => {
    apiFetch('/analytics', {
      method: 'POST',
      body: JSON.stringify({ path: '/projects' }),
    }).catch(() => {});
  }, []);

  const allTags = useMemo(() => {
    if (!projects) return [];
    const tags = new Set<string>();
    projects.forEach((p) => p.techStack.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p) => {
      const matchesDomain = domainFilter === 'ALL' || p.domains.includes(domainFilter);
      const matchesTag = tagFilter === 'ALL' || p.techStack.includes(tagFilter);
      return matchesDomain && matchesTag;
    });
  }, [projects, domainFilter, tagFilter]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" role="status" aria-label="Loading projects" />
      </div>
    );
  }

  if (isError || !projects) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-4">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold mb-2">Failed to load projects</h2>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pt-32 pb-24 text-slate-700 dark:text-slate-100 min-h-screen">
      <Seo title="Projects" description="Case studies across software development, AI engineering, and data engineering." path="/projects" />

      <h1 className="text-3xl md:text-5xl font-extrabold mb-4 text-slate-900 dark:text-white">Case Studies</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-10">A detailed directory of visual web editors, platform architectures, and e-commerce projects.</p>

      <div className="flex flex-wrap gap-3 mb-12" role="group" aria-label="Filter projects">
        <label className="sr-only" htmlFor="domain-filter">Filter by domain</label>
        <select
          id="domain-filter"
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value as ProjectDomain | 'ALL')}
          className="form-input w-auto"
        >
          <option value="ALL">All domains</option>
          {DOMAIN_OPTIONS.map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </select>

        <label className="sr-only" htmlFor="tag-filter">Filter by tech tag</label>
        <select
          id="tag-filter"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="form-input w-auto"
        >
          <option value="ALL">All tech</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>

      {filteredProjects.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400 text-center py-16">No projects match these filters.</p>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredProjects.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden flex flex-col group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <div className="h-48 overflow-hidden relative">
              <img src={project.coverImageUrl} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-6 flex flex-col flex-grow">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {project.domains.map((d) => (
                  <span key={d} className="bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
                    {PROJECT_DOMAIN_META[d]?.label ?? d}
                  </span>
                ))}
              </div>
              <h3 className="text-xl font-bold mb-3 line-clamp-2 text-slate-900 dark:text-white">{project.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 line-clamp-3">{project.summary}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {project.techStack.map((tag) => (
                  <span key={tag} className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-1 rounded-md">{tag}</span>
                ))}
              </div>
              <div className="flex-grow" />
              <div className="flex items-center justify-between mt-auto">
                <Link to={`/projects/${project.slug}`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 text-sm font-semibold">
                  Read Case Study &rarr;
                </Link>
                <div className="flex gap-3 text-slate-500 dark:text-slate-400">
                  {project.repoUrl && (
                    <a href={project.repoUrl} target="_blank" rel="noreferrer" aria-label={`${project.title} repository`} className="hover:text-indigo-500 dark:hover:text-indigo-400">
                      <Github size={18} />
                    </a>
                  )}
                  {project.liveUrl && (
                    <a href={project.liveUrl} target="_blank" rel="noreferrer" aria-label={`${project.title} live demo`} className="hover:text-indigo-500 dark:hover:text-indigo-400">
                      <ExternalLink size={18} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
