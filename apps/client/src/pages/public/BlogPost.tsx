import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Seo } from '../../components/ui/Seo';
import { BlockRenderer } from '../../components/public/BlockRenderer';
import { AlertCircle } from 'lucide-react';
import { renderMarkdown } from '../../lib/renderMarkdown';
import type { ContentBlock } from '@portfolio/shared';

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['blogPost', slug],
    queryFn: async () => {
      const res = await apiFetch(`/blog/${slug}`);
      if (!res.ok) throw new Error('Failed to load post');
      return res.json();
    }
  });

  useEffect(() => {
    if (slug) {
      apiFetch('/analytics', {
        method: 'POST',
        body: JSON.stringify({ path: `/blog/${slug}` }),
      }).catch(() => {});
    }
  }, [slug]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" role="status" aria-label="Loading article" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-4">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold mb-4">Article not found</h2>
        <button onClick={() => navigate('/blog')} className="px-4 py-2 bg-indigo-600 text-white rounded">Back to blog list</button>
      </div>
    );
  }

  const hasBlocks = Array.isArray(post.contentBlocks) && post.contentBlocks.length > 0;

  return (
    <article className="max-w-4xl mx-auto px-6 sm:px-8 pt-32 pb-24 text-slate-700 dark:text-slate-100 min-h-screen">
      <Seo
        title={post.metaTitle || post.title}
        description={post.metaDescription || post.excerpt}
        image={post.ogImageUrl || post.coverImageUrl}
        path={`/blog/${post.slug}`}
        type="article"
      />

      <button onClick={() => navigate('/blog')} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold mb-8 flex items-center gap-1">
        &larr; Back to Articles
      </button>

      {post.coverImageUrl && (
        <img src={post.coverImageUrl} referrerPolicy="no-referrer" alt="" className="w-full max-h-[360px] object-cover rounded-xl mb-8 border border-slate-200 dark:border-slate-800" />
      )}

      <span className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2 block">
        {formatDate(post.publishedAt)}
      </span>

      <h1 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight text-slate-900 dark:text-white">{post.title}</h1>

      <div className="flex flex-wrap gap-2 mb-8">
        {post.tags?.map((t: string) => (
          <span key={t} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2.5 py-0.5 rounded">#{t}</span>
        ))}
      </div>

      {hasBlocks ? (
        <div className="border-t border-slate-200 dark:border-slate-900 pt-8">
          <BlockRenderer blocks={post.contentBlocks as ContentBlock[]} />
        </div>
      ) : (
        <div className="blog-content border-t border-slate-200 dark:border-slate-900 pt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }} />
      )}
    </article>
  );
}
