import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Seo } from '../../components/ui/Seo';
import { BlockRenderer } from '../../components/public/BlockRenderer';
import { Github, ExternalLink, AlertCircle } from 'lucide-react';
import { renderMarkdown } from '../../lib/renderMarkdown';
import { PROJECT_DOMAIN_META, ProjectDomain, ContentBlock } from '@portfolio/shared';
import type { Project } from '@portfolio/types';

export default function ProjectDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { data: project, isLoading, isError } = useQuery<Project>({
    queryKey: ['project', slug],
    queryFn: async () => {
      const res = await apiFetch(`/projects/${slug}`);
      if (!res.ok) throw new Error('Project not found');
      return res.json();
    }
  });

  useEffect(() => {
    if (slug) {
      apiFetch('/analytics', {
        method: 'POST',
        body: JSON.stringify({ path: `/projects/${slug}` }),
      }).catch(() => {});
    }
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" role="status" aria-label="Loading project" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-4">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold mb-4">Case study not found</h2>
        <button onClick={() => navigate('/projects')} className="px-4 py-2 bg-indigo-600 text-white rounded">Back to projects</button>
      </div>
    );
  }

  const hasBlocks = Array.isArray(project.contentBlocks) && project.contentBlocks.length > 0;

  return (
    <article className="max-w-5xl mx-auto px-6 sm:px-8 pt-32 pb-24 text-slate-700 dark:text-slate-100 min-h-screen">
      <Seo
        title={project.metaTitle || project.title}
        description={project.metaDescription || project.summary}
        image={project.ogImageUrl || project.coverImageUrl}
        path={`/projects/${project.slug}`}
        type="article"
      />

      <button onClick={() => navigate('/projects')} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold mb-8 flex items-center gap-1">
        &larr; Back to Projects
      </button>
      {project.coverImageUrl && (
        <img src={project.coverImageUrl} referrerPolicy="no-referrer" alt="" loading="lazy" className="w-full max-h-[400px] object-cover rounded-xl mb-8 border border-slate-200 dark:border-slate-800" />
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {project.isClientProject && (
          <span className="bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">Freelance</span>
        )}
        {project.domains.map((d: ProjectDomain) => (
          <span key={d} className="bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
            {PROJECT_DOMAIN_META[d]?.label ?? d}
          </span>
        ))}
      </div>

      <h1 className="text-3xl md:text-5xl font-extrabold mb-4 text-slate-900 dark:text-white">{project.title}</h1>
      {project.role && <p className="text-slate-500 dark:text-slate-400 mb-4">{project.role}</p>}
      <div className="flex flex-wrap gap-2 mb-8">
        {project.techStack.map((t) => (
          <span key={t} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded">{t}</span>
        ))}
      </div>

      {hasBlocks ? (
        <BlockRenderer blocks={project.contentBlocks as ContentBlock[]} />
      ) : (
        <div className="project-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(project.description) }} />
      )}

      {project.gallery?.length > 0 && (
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-900">
          <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Gallery</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[...project.gallery].sort((a, b) => a.order - b.order).map((img) => (
              <figure key={img.id || img.url}>
                <img src={img.url} referrerPolicy="no-referrer" alt={img.altText || img.caption || ''} loading="lazy" className="w-full rounded-xl border border-slate-200 dark:border-slate-800" />
                {img.caption && <figcaption className="text-center text-xs text-slate-500 mt-2">{img.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 mt-12 pt-8 border-t border-slate-200 dark:border-slate-900">
        {project.repoUrl && (
          <a href={project.repoUrl} target="_blank" rel="noreferrer" className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-lg flex items-center gap-2 transition-colors border border-slate-200 dark:border-slate-700">
            <Github size={16} /> Repository Code
          </a>
        )}
        {project.liveUrl && (
          <a href={project.liveUrl} target="_blank" rel="noreferrer" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-indigo-500/20">
            <ExternalLink size={16} /> Live Application
          </a>
        )}
      </div>
    </article>
  );
}
