import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ContactMessage, PaginatedResponse } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { Pagination } from '../../components/admin/Pagination';
import { Eye, Check, Trash2, X, Inbox, Reply } from 'lucide-react';

const PAGE_SIZE = 20;

function mailtoLink(sub: { email: string; name: string; subject?: string }) {
  const subject = encodeURIComponent(`Re: ${sub.subject || 'Your message'}`);
  const body = encodeURIComponent(`Hi ${sub.name},\n\n`);
  return `mailto:${sub.email}?subject=${subject}&body=${body}`;
}

export default function MessagesInbox() {
  const queryClient = useQueryClient();
  const [viewSubmission, setViewSubmission] = useState<ContactMessage | null>(null);
  const [page, setPage] = useState(1);

  const { data: submissionsPage } = useQuery<PaginatedResponse<ContactMessage>>({
    queryKey: ['adminSubmissionsInbox', page],
    queryFn: async () => {
      const res = await apiFetch(`/messages?page=${page}&limit=${PAGE_SIZE}`);
      return res.json();
    }
  });
  const submissions = submissionsPage?.data;

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/messages/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSubmissionsInbox'] });
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
      queryClient.invalidateQueries({ queryKey: ['adminSubmissionsInbox'] });
    }
  });

  return (
    <div className="space-y-6 text-slate-100">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-white">Inquiries Inbox</h1>
        <p className="text-slate-400 text-sm">Read and manage incoming contact submissions.</p>
      </header>

      {submissions && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
                <th className="p-4">Sender</th>
                <th className="p-4">Subject</th>
                <th className="p-4">Message Preview</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => (
                <tr key={sub.id} className={`border-b border-slate-800 last:border-0 hover:bg-slate-950/20 ${sub.isRead ? 'opacity-60' : 'bg-amber-500/5 font-semibold text-white'}`}>
                  <td className="p-4">
                    {sub.isRead ? <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded">Read</span> : <span className="bg-amber-500/10 text-amber-500 text-xs px-2 py-0.5 rounded font-bold">Unread</span>}
                  </td>
                  <td className="p-4 text-xs text-slate-500">{new Date(sub.createdAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className="block text-white font-bold">{sub.name}</span>
                    <span className="text-xs text-slate-500 block">{sub.email}</span>
                  </td>
                  <td className="p-4">{sub.subject}</td>
                  <td className="p-4 max-w-xs truncate">{sub.message}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setViewSubmission(sub)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"><Eye size={14} /></button>
                      <a href={mailtoLink(sub)} aria-label={`Reply to ${sub.name}`} className="p-1.5 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 rounded inline-flex"><Reply size={14} /></a>
                      <button onClick={() => toggleReadMutation.mutate({ id: sub.id, isRead: !sub.isRead })} className="p-1.5 text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 rounded"><Check size={14} /></button>
                      <button onClick={() => deleteSubmissionMutation.mutate(sub.id)} className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <Inbox className="mx-auto mb-4 opacity-30" size={48} />
                    No inquiry submissions received yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {submissionsPage?.pagination && (
            <Pagination
              page={submissionsPage.pagination.page}
              totalPages={submissionsPage.pagination.totalPages}
              total={submissionsPage.pagination.total}
              limit={submissionsPage.pagination.limit}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

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
              <a
                href={mailtoLink(viewSubmission)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs flex items-center gap-1.5"
              >
                <Reply size={14} /> Reply via email
              </a>
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
              <button onClick={() => setViewSubmission(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
