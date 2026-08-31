import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';
import {
  LayoutDashboard, FolderKanban, Award, Briefcase, BadgeCheck, Layers,
  Bookmark, ChevronDown,
  FileText, MessageSquare, Inbox, Image as ImageIcon, BarChart3, Settings as SettingsIcon,
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
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed top-0 bottom-0 left-0 z-20">
        <div className="p-6 border-b border-slate-800 flex items-center gap-2">
          <Shield className="text-indigo-500 animate-pulse" size={24} />
          <span className="font-extrabold tracking-wider font-heading text-gradient">AURA CMS</span>
        </div>

        <nav aria-label="Admin" className="p-4 flex flex-col gap-1 flex-grow overflow-y-auto">
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
                <Icon size={18} /> {item.label}
              </Link>
            );
          })}

          <ResourcesNav items={resourceItems} open={inResources} currentPath={location.pathname} />
        </nav>

        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="truncate">
            <span className="block text-sm font-semibold truncate text-white">{user?.name}</span>
            <span className="text-xs text-slate-500 truncate block">{user?.email}</span>
          </div>
          <button onClick={handleLogout} aria-label="Log out" className="text-red-500 hover:text-red-400 p-2 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Content panel */}
      <main className="ml-64 flex-grow p-10">
        {children}
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
        <div id="admin-nav-resources" className="ml-4 mt-1 flex flex-col gap-1 border-l border-slate-800 pl-3">
          {items.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              aria-current={currentPath === item.path ? 'page' : undefined}
              className={`text-sm py-1.5 px-2 rounded transition-colors ${
                currentPath === item.path
                  ? 'text-indigo-400 font-semibold'
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
