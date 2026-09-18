import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';
import {
  LayoutDashboard, FolderKanban, Award, Briefcase, BadgeCheck, Layers,
  Bookmark, ChevronDown,
  FileText, FileDown, MessageSquare, Inbox, Image as ImageIcon, BarChart3, Settings as SettingsIcon,
  LogOut, Shield
} from 'lucide-react';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {}
    logout();
    navigate('/admin/login');
  };

  const menuItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/pages', label: 'Pages', icon: Layers },
    { path: '/admin/projects', label: 'Projects', icon: FolderKanban },
    { path: '/admin/skills', label: 'Skills', icon: Award },
    { path: '/admin/certifications', label: 'Certifications', icon: BadgeCheck },
    { path: '/admin/experience', label: 'Experience', icon: Briefcase },
    { path: '/admin/blogs', label: 'Blog Posts', icon: FileText },
    { path: '/admin/testimonials', label: 'Testimonials', icon: MessageSquare },
    { path: '/admin/resume', label: 'Resume', icon: FileDown },
    { path: '/admin/messages', label: 'Submissions', icon: Inbox },
    { path: '/admin/media', label: 'Media Library', icon: ImageIcon },
    { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/admin/settings', label: 'Settings', icon: SettingsIcon },
  ];

  // ADMIN-ONLY. A private bookmarking tool, never part of the public site's navigation —
  // that nav is built from published Page documents, and no Page references this module.
  // Configuration sits next to what it configures, so the two taxonomy screens are
  // sub-items of Resources rather than separate top-level entries.
  const resourceItems = [
    { path: '/admin/resources', label: 'Resources' },
    { path: '/admin/main-types', label: 'Main Types' },
    { path: '/admin/sub-types', label: 'Sub Types' },
  ];
  const inResources = resourceItems.some((item) => location.pathname === item.path);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-body">
      {/* Sidebar navigation */}
      <aside className="fixed left-0 top-0 bottom-0 z-20 flex w-64 flex-col border-r border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-6 py-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400">
            <Shield size={17} />
          </span>
          <div className="leading-tight">
            <span className="block font-heading text-sm font-bold tracking-wide text-white">AURA</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">content studio</span>
          </div>
        </div>

        <nav aria-label="Admin" className="flex flex-grow flex-col gap-0.5 overflow-y-auto p-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`nav-btn ${isActive ? 'active' : ''}`}
              >
                <Icon size={17} strokeWidth={2} /> {item.label}
              </Link>
            );
          })}

          <ResourcesNav items={resourceItems} open={inResources} currentPath={location.pathname} />
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-slate-800 p-4">
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{user?.name}</span>
            <span className="block truncate font-mono text-[11px] text-slate-500">{user?.email}</span>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Log out"
            className="shrink-0 rounded-md p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {/* Content panel */}
      <main className="ml-64 flex-grow p-6 md:p-10 lg:px-14 lg:py-12">
        <div className="mx-auto max-w-[100rem]">{children}</div>
      </main>
    </div>
  );
}

/**
 * Collapsible group. Starts expanded when one of its pages is open, so navigating
 * straight to /admin/sub-types does not land the reader in a collapsed section with no
 * indication of where they are.
 */
function ResourcesNav({ items, open, currentPath }: {
  items: { path: string; label: string }[];
  open: boolean;
  currentPath: string;
}) {
  const [expanded, setExpanded] = React.useState(open);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls="admin-nav-resources"
        className={`nav-btn w-full justify-between ${open ? 'active' : ''}`}
      >
        <span className="flex items-center gap-2">
          <Bookmark size={18} /> Resources
        </span>
        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {expanded && (
        <div id="admin-nav-resources" className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-slate-800 pl-3">
          {items.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              aria-current={currentPath === item.path ? 'page' : undefined}
              className={`rounded-md px-2 py-1.5 text-sm transition-colors ${
                currentPath === item.path
                  ? 'font-semibold text-indigo-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
