import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AnalyticsSummary } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, ExternalLink, Eye } from 'lucide-react';

export default function Analytics() {
  const { data: stats } = useQuery<AnalyticsSummary>({
    queryKey: ['adminAnalytics'],
    queryFn: async () => (await apiFetch('/analytics/summary')).json(),
  });

  return (
    <div className="space-y-8 text-slate-100">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-white">Analytics</h1>
        <p className="text-slate-400 text-sm">Page views over time, top pages, and referral sources.</p>
      </header>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
            <span className="text-xs text-slate-500 uppercase font-semibold block mb-2">Total Page Views</span>
            <span className="text-3xl font-bold text-white">{stats.totalPageViews}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
            <span className="text-xs text-slate-500 uppercase font-semibold block mb-2">Tracked Pages</span>
            <span className="text-3xl font-bold text-white">{stats.topPages?.length ?? 0}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
            <span className="text-xs text-slate-500 uppercase font-semibold block mb-2">Referral Sources</span>
            <span className="text-3xl font-bold text-white">{stats.topReferrers?.length ?? 0}</span>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
          <TrendingUp size={18} className="text-indigo-500" /> Page Views — Last 30 Days
        </h2>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={stats?.viewsOverTime || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {(!stats?.viewsOverTime || stats.viewsOverTime.length === 0) && (
          <p className="text-slate-500 text-sm text-center py-8">No page views recorded in the last 30 days.</p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
            <Eye size={18} className="text-indigo-500" /> Top Pages
          </h2>
          <div className="space-y-3">
            {stats?.topPages?.slice(0, 8).map((p) => (
              <div key={p.path} className="flex justify-between items-center text-sm">
                <span className="font-mono text-slate-300 truncate">{p.path}</span>
                <span className="text-indigo-400 font-bold">{p.count}</span>
              </div>
            ))}
            {(!stats?.topPages || stats.topPages.length === 0) && <p className="text-slate-500 text-sm text-center py-4">No data yet.</p>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
            <ExternalLink size={18} className="text-emerald-500" /> Top Referrers
          </h2>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={stats?.topReferrers || []} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="referrer" stroke="#64748b" fontSize={10} width={120} tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 20)}…` : v)} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(!stats?.topReferrers || stats.topReferrers.length === 0) && (
            <p className="text-slate-500 text-sm text-center py-4">No referrer data yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
