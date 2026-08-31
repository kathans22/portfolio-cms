import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ResolveResult } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { Seo } from '../../components/ui/Seo';
import DynamicPage from './DynamicPage';
import { AlertCircle, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * The single catch-all. One request decides what a URL means, so admin-created routes
 * work without a deploy and /projects/<x> is never ambiguous between a Project document
 * and an authored sub-page.
 */
export default function Resolver() {
  const location = useLocation();
  const path = location.pathname;

  const { data, isLoading, isError } = useQuery<ResolveResult>({
    queryKey: ['resolve', path],
    queryFn: async () => {
      const res = await apiFetch(`/resolve?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error('Failed to resolve this URL');
      return res.json();
    },
    // A resolved URL rarely changes mid-visit; this also lets back/forward be instant.
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (data?.kind && data.kind !== 'NOT_FOUND' && data.kind !== 'REDIRECT') {
      apiFetch('/analytics', { method: 'POST', body: JSON.stringify({ path }) }).catch(() => {});
    }
  }, [data?.kind, path]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" role="status" aria-label="Loading page" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4 text-center">
        <AlertCircle className="text-red-500 mb-4" size={44} />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h1>
        <p className="text-slate-500 dark:text-slate-400">We couldn&apos;t load this page. Please try again.</p>
      </div>
    );
  }

  switch (data.kind) {
    case 'PAGE':
      return <DynamicPage page={data.data} />;

    case 'REDIRECT':
      // The page moved. `replace` keeps the dead URL out of session history.
      return <Navigate to={data.to} replace />;

    // Typed detail routes stay hand-built and fully typed — they render one rich
    // document each and are deliberately not forced through the section system. They
    // keep their own routes, so the resolver only reaches these for URLs those routes
    // didn't already claim.
    case 'PROJECT':
      return <Navigate to={`/projects/${(data.data as { slug: string }).slug}`} replace />;
    case 'BLOG_POST':
      return <Navigate to={`/blog/${(data.data as { slug: string }).slug}`} replace />;

    case 'NOT_FOUND':
    default:
      return <NotFound />;
  }
}

function NotFound() {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen p-4 text-center">
      <Seo title="Page not found" description="This page could not be found." />
      <Compass className="text-slate-400 mb-4" size={44} aria-hidden="true" />
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Page not found</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link to="/" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors">
        Back to home
      </Link>
    </div>
  );
}
