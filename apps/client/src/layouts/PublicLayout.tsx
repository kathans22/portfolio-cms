import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { CmsNavDesktop, CmsNavMobile } from '../components/public/CmsNav';
import { Menu, X, Github, Linkedin } from 'lucide-react';

/** Profile URLs as they appear on the résumé PDF. */
const SOCIALS = [
  { href: 'https://www.linkedin.com/in/kathanshah-dev/', label: 'LinkedIn', icon: Linkedin },
  { href: 'https://github.com/kathans22', label: 'GitHub', icon: Github },
];

const LINKS = [
  { to: '/projects', label: 'Projects' },
  { to: '/blog', label: 'Blogs' },
  { to: '/certifications', label: 'Certifications' },
  { to: '/about', label: 'Résumé' },
  { to: '/contact', label: 'Contact' },
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <div className={theme}>
      <div className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 min-h-screen font-body transition-colors duration-300">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>

        <header className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/75">
          <div className="container-wide flex h-full items-center justify-between">
            <Link to="/" className="group flex items-center gap-2 font-heading text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-900 font-mono text-sm text-white transition-transform group-hover:-rotate-6 dark:bg-white dark:text-slate-900">
                K
              </span>
              Kathan
            </Link>

            {/* Desktop nav */}
            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              {LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={isActive(link.to) ? 'page' : undefined}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <CmsNavDesktop />
              <span className="mx-2 h-5 w-px bg-slate-200 dark:bg-slate-800" />
              <ThemeToggle className="ml-1" />
            </nav>

            {/* Mobile toggle */}
            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                className="rounded-md p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </header>

        {mobileOpen && (
          <nav
            id="mobile-nav"
            aria-label="Mobile"
            className="fixed inset-x-0 top-20 z-40 flex flex-col gap-1 border-b border-slate-200 bg-slate-50 p-6 text-base font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 md:hidden"
          >
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2.5 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <CmsNavMobile onNavigate={() => setMobileOpen(false)} />
          </nav>
        )}

        <motion.main
          id="main-content"
          className="min-h-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {children}
        </motion.main>

        <footer className="border-t border-slate-200 dark:border-slate-900">
          {/* col-reverse on mobile so the profile links — the only actionable thing
              down here — sit above the copyright line rather than under it. */}
          <div className="container-wide flex flex-col-reverse items-center justify-between gap-5 py-10 text-sm text-slate-500 sm:flex-row">
            <span className="font-mono text-xs">
              © {new Date().getFullYear()} Kathan Shah
            </span>

            {/* aria-label carries the name because each anchor's only child is an icon
                — without it a screen reader just announces "link". */}
            <ul className="flex items-center gap-2">
              {SOCIALS.map(({ href, label, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Kathan Shah on ${label}`}
                    title={label}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-100/70 hover:text-indigo-600 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800/50 dark:hover:text-indigo-400"
                  >
                    <Icon size={16} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      </div>
    </div>
  );
}
