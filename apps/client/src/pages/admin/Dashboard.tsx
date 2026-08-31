import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AnalyticsSummary, ContactMessage, Project, Certification } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { getExpiryStatus } from '../../lib/certificationExpiry';
import { TrendingUp, Inbox, Eye, X, FolderKanban, FileText, MessageSquare, Image as ImageIcon, BadgeCheck, CalendarClock } from 'lucide-react';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [viewSubmission, setViewSubmission] = useState<ContactMessage | null>(null);

  const { data: stats } = useQuery<AnalyticsSummary>({
    queryKey: ['adminStats'],
    queryFn: async () => (await apiFetch('/analytics/summary')).json(),
  });

  const { data: submissions } = useQuery<ContactMessage[]>({
    queryKey: ['adminSubmissions'],
    queryFn: async () => (await apiFetch('/messages')).json(),
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['adminProjects'],
    queryFn: async () => (await apiFetch('/projects')).json(),
  });

  const { data: certifications } = useQuery<Certification[]>({
    queryKey: ['adminCertifications'],
    queryFn: async () => (await apiFetch('/admin/certifications')).json(),
  });

  // Renewals should surface here, not via a recruiter clicking a dead verification link.
  const expiringSoon = (certifications ?? [])
    .filter((cert) => cert.expiresSoon)
    .sort((a, b) => new Date(a.expiryDate ?? 0).getTime() - new Date(b.expiryDate ?? 0).getTime());

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/messages/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSubmissions'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    }
  });

  const toggleReadMutation = useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      await apiFetch(`/messages/${id}/read`, {
        method: 'PATCH',
        body: JSON.stringify({ isRead }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSubmissions'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    }
  });

  const pageViewsThisWeek = (stats?.viewsOverTime || [])
    .slice(-7)
    .reduce((sum, day) => sum + day.count, 0);

  const quickLinks = [
    { to: '/admin/projects', label: 'New Project', icon: FolderKanban },
    { to: '/admin/blogs', label: 'New Article', icon: FileText },
    { to: '/admin/messages', label: 'Inbox', icon: MessageSquare },
    { to: '/admin/media', label: 'Media Library', icon: ImageIcon },
  ];

  return (
    <div className="space-y-8 text-slate-100">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-white">Dashboard Overview</h1>
        <p className="text-slate-400 text-sm">Real-time usage statistics and form inquiries.</p>
      </header>

      <div className="flex flex-wrap gap-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Icon size={16} /> {link.label}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <span className="text-xs text-slate-500 uppercase font-semibold block mb-2">Total Projects</span>
          <span className="text-3xl font-bold text-white">{projects?.length ?? '—'}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <span className="text-xs text-slate-500 uppercase font-semibold block mb-2">Page Views This Week</span>
          <span className="text-3xl font-bold text-white">{stats ? pageViewsThisWeek : '—'}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <span className="text-xs text-slate-500 uppercase font-semibold block mb-2">Inquiry Messages</span>
          <span className="text-3xl font-bold text-white">{stats?.submissionsCount ?? '—'}</span>
        </div>
        <div className={`bg-slate-900 border p-6 rounded-xl transition-colors ${(stats?.unreadSubmissionsCount ?? 0) > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800'}`}>
          <span className="text-xs text-slate-500 uppercase font-semibold block mb-2">Unread Messages</span>
          <span className={`text-3xl font-bold ${(stats?.unreadSubmissionsCount ?? 0) > 0 ? 'text-amber-500' : 'text-white'}`}>{stats?.unreadSubmissionsCount ?? '—'}</span>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2 text-white">
            <CalendarClock size={18} className="text-amber-400" /> Credentials expiring soon
          </h2>
          <p className="text-slate-400 text-xs mb-5">
            Within the next 90 days. Renew before a visitor finds a dead verification link.
          </p>
          <ul className="space-y-2">
            {expiringSoon.map((cert) => {
              const expiry = getExpiryStatus(cert);
              return (
                <li key={cert.id} className="flex items-center justify-between gap-4 bg-slate-950/40 border border-slate-800 rounded-lg px-4 py-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <BadgeCheck size={14} className="text-amber-400 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white truncate">{cert.name}</span>
                      <span className="block text-xs text-slate-500 truncate">{cert.issuingOrganization}</span>
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-amber-400 whitespace-nowrap">{expiry.label}</span>
                </li>
              );
            })}
          </ul>
          <Link to="/admin/certifications" className="inline-block mt-4 text-xs font-semibold text-indigo-400 hover:text-indigo-300">
            Manage certifications &rarr;
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Paths view */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
            <TrendingUp size={18} className="text-indigo-500" /> Paths Traffic
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500 font-semibold border-b border-slate-800">
                  <th className="pb-3">Path Route</th>
                  <th className="pb-3 text-right">Visits</th>
                </tr>
              </thead>
              <tbody>
                {stats?.topPages?.map((p) => (
                  <tr key={p.path} className="border-b border-slate-800 last:border-0">
                    <td className="py-3 font-mono text-slate-300">{p.path}</td>
                    <td className="py-3 text-right text-indigo-400 font-bold">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats && (!stats.topPages || stats.topPages.length === 0) && (
              <p className="text-slate-500 text-sm text-center py-6">No page views recorded yet.</p>
            )}
          </div>
        </div>

        {/* Submissions brief */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
            <Inbox size={18} className="text-emerald-500" /> Recent Submissions
          </h2>
          <div className="space-y-3">
            {submissions?.slice(0, 4).map((sub) => (
              <div
                key={sub.id}
                onClick={() => setViewSubmission(sub)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') setViewSubmission(sub); }}
                className={`p-4 rounded-lg cursor-pointer border flex justify-between items-center transition-colors ${sub.isRead ? 'bg-slate-950/40 border-slate-800 hover:border-slate-700' : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'}`}
              >
                <div>
                  <span className="font-semibold text-white block text-sm">{sub.name}</span>
                  <span className="text-xs text-slate-500 truncate block max-w-xs">{sub.subject}</span>
                </div>
                <div className="flex items-center gap-3">
                  {!sub.isRead && <span className="bg-amber-500/10 text-amber-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Unread</span>}
                  <Eye size={16} className="text-slate-500" />
                </div>
              </div>
            ))}
            {submissions?.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No contact forms submitted yet.</p>}
          </div>
        </div>
      </div>

      {/* View detail modal */}
      {viewSubmission && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6 relative">
            <button onClick={() => setViewSubmission(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
            <h3 className="text-xl font-bold text-white mb-6">Contact Submission Details</h3>

            <div className="space-y-4 text-sm">
              <div>
                <span className="text-slate-500 text-xs font-semibold block mb-1">Sender</span>
                <p className="text-white font-bold">{viewSubmission.name} &lt;{viewSubmission.email}&gt;</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs font-semibold block mb-1">Date Submitted</span>
                <p>{new Date(viewSubmission.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs font-semibold block mb-1">Subject</span>
                <p className="text-white font-semibold text-base">{viewSubmission.subject}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs font-semibold block mb-1">Message</span>
                <p className="bg-slate-950 border border-slate-800 p-4 rounded-lg text-slate-300 leading-relaxed whitespace-pre-wrap">{viewSubmission.message}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-800 mt-6">
              <button
                onClick={() => {
                  toggleReadMutation.mutate({ id: viewSubmission.id, isRead: !viewSubmission.isRead });
                  setViewSubmission({ ...viewSubmission, isRead: !viewSubmission.isRead });
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Mark as {viewSubmission.isRead ? 'Unread' : 'Read'}
              </button>
              <button
                onClick={() => {
                  deleteSubmissionMutation.mutate(viewSubmission.id);
                  setViewSubmission(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs"
              >
                Delete submission
              </button>
              <button onClick={() => setViewSubmission(null)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
