import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiFetch } from '../../lib/api';
import { Seo } from '../../components/ui/Seo';
import { AlertCircle } from 'lucide-react';
import { PROJECT_DOMAIN_META, ProjectDomain } from '@portfolio/shared';
import type { BlogPost } from '@portfolio/types';

const DOMAIN_OPTIONS = Object.entries(PROJECT_DOMAIN_META) as [ProjectDomain, { label: string; slug: string }][];

export default function Blog() {
  const [domainFilter, setDomainFilter] = useState<ProjectDomain | 'ALL'>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');

  const { data: posts, isLoading, isError } = useQuery<BlogPost[]>({
    queryKey: ['blogList'],
    queryFn: async () => {
      const res = await apiFetch('/blog');
      return res.json();
    }
  });

  useEffect(() => {
    apiFetch('/analytics', {
      method: 'POST',
      body: JSON.stringify({ path: '/blog' }),
    }).catch(() => {});
  }, []);

  const allTags = useMemo(() => {
    if (!posts) return [];
    const tags = new Set<string>();
    posts.forEach((p) => p.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter((p) => {
      const matchesDomain = domainFilter === 'ALL' || p.domains.includes(domainFilter);
      const matchesTag = tagFilter === 'ALL' || p.tags.includes(tagFilter);
      return matchesDomain && matchesTag;
    });
  }, [posts, domainFilter, tagFilter]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" role="status" aria-label="Loading articles" />
      </div>
    );
  }

  if (isError || !posts) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-4">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold mb-2">Failed to load articles</h2>
      </div>
    );
  }

  return (
    <div className="container-wide pt-32 pb-24 text-slate-700 dark:text-slate-100 min-h-screen">
      <Seo title="Blog" description="Tutorials, thoughts, and reflections on code structures, databases, and developer productivity." path="/blog" />

      <h1 className="text-3xl md:text-5xl font-extrabold mb-4 text-slate-900 dark:text-white">Latest Insights</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-10">Tutorials, thoughts, and reflections on code structures, databases, and developer productivity.</p>

      <div className="flex flex-wrap gap-3 mb-12" role="group" aria-label="Filter articles">
        <label className="sr-only" htmlFor="blog-domain-filter">Filter by domain</label>
        <select
          id="blog-domain-filter"
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value as ProjectDomain | 'ALL')}
          className="form-input w-auto"
        >
          <option value="ALL">All domains</option>
          {DOMAIN_OPTIONS.map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </select>

        <label className="sr-only" htmlFor="blog-tag-filter">Filter by tag</label>
        <select
          id="blog-tag-filter"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="form-input w-auto"
        >
          <option value="ALL">All tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>

      {filteredPosts.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400 text-center py-16">No articles match these filters.</p>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredPosts.map((blog, i) => (
          <motion.div
            key={blog.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col"
          >
            <Link to={`/blog/${blog.slug}`} className="flex flex-col flex-grow">
              {blog.coverImageUrl && (
                <div className="h-48 overflow-hidden">
                  <img src={blog.coverImageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-6 flex flex-col flex-grow">
                <span className="text-xs text-indigo-600 dark:text-indigo-400 mb-2 block">{formatDate(blog.publishedAt)}</span>
                <h3 className="text-lg font-bold mb-3 line-clamp-2 text-slate-900 dark:text-white">{blog.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 line-clamp-3">{blog.excerpt}</p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {blog.tags.map((t) => (
                    <span key={t} className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded">#{t}</span>
                  ))}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
