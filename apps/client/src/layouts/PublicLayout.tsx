import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { CmsNavDesktop, CmsNavMobile } from '../components/public/CmsNav';
import { Menu, X } from 'lucide-react';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isHome = location.pathname === '/';

  return (
    <div className={theme}>
      <div className="bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-100 min-h-screen font-body transition-colors duration-200">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>

        <header className="fixed top-0 left-0 right-0 h-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-900/80 flex items-center justify-between px-6 z-50">
          <Link to="/" className="text-2xl font-bold tracking-tight text-gradient font-heading">
            Kathan
          </Link>

          {/* Desktop Nav */}
          <nav aria-label="Primary" className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {isHome ? (
              <>
                <a href="#projects" className="hover:text-slate-900 dark:hover:text-white transition-colors">Projects</a>
                <a href="#skills" className="hover:text-slate-900 dark:hover:text-white transition-colors">Skills</a>
                <a href="#timeline" className="hover:text-slate-900 dark:hover:text-white transition-colors">Timeline</a>
                <a href="#blog" className="hover:text-slate-900 dark:hover:text-white transition-colors">Blog</a>
                <a href="#contact" className="hover:text-slate-900 dark:hover:text-white transition-colors">Contact</a>
              </>
            ) : (
              <>
                <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
                <Link to="/projects" className="hover:text-slate-900 dark:hover:text-white transition-colors">Projects</Link>
                <Link to="/blog" className="hover:text-slate-900 dark:hover:text-white transition-colors">Blog</Link>
                <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white transition-colors">Contact</Link>
              </>
            )}
            <Link to="/certifications" className="hover:text-slate-900 dark:hover:text-white transition-colors">Certifications</Link>
            <Link to="/about" className="hover:text-slate-900 dark:hover:text-white transition-colors">About</Link>
            {/* Admin-created pages, appended to the hardcoded links. Renders nothing
                until pages exist, so the header is unchanged on a fresh install. */}
            <CmsNavDesktop />
            <ThemeToggle />
          </nav>

          {/* Mobile Nav Toggle */}
          <div className="md:hidden flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </header>

        {/* Mobile menu */}
        {mobileOpen && (
          <nav
            id="mobile-nav"
            aria-label="Mobile"
            className="fixed top-20 left-0 right-0 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-900 z-40 p-6 flex flex-col gap-4 font-semibold text-slate-600 dark:text-slate-300 md:hidden"
          >
            {isHome ? (
              <>
                <a href="#projects" onClick={() => setMobileOpen(false)}>Projects</a>
                <a href="#skills" onClick={() => setMobileOpen(false)}>Skills</a>
                <a href="#timeline" onClick={() => setMobileOpen(false)}>Timeline</a>
                <a href="#blog" onClick={() => setMobileOpen(false)}>Blog</a>
                <a href="#contact" onClick={() => setMobileOpen(false)}>Contact</a>
              </>
            ) : (
              <>
                <Link to="/" onClick={() => setMobileOpen(false)}>Home</Link>
                <Link to="/projects" onClick={() => setMobileOpen(false)}>Projects</Link>
                <Link to="/blog" onClick={() => setMobileOpen(false)}>Blog</Link>
                <Link to="/contact" onClick={() => setMobileOpen(false)}>Contact</Link>
              </>
            )}
            <Link to="/certifications" onClick={() => setMobileOpen(false)}>Certifications</Link>
            <Link to="/about" onClick={() => setMobileOpen(false)}>About</Link>
            {/* Accordion, not a hover dropdown — hover has no meaning on touch. */}
            <CmsNavMobile onNavigate={() => setMobileOpen(false)} />
          </nav>
        )}

        <motion.main
          id="main-content"
          className="min-h-screen"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {children}
        </motion.main>

        <footer className="border-t border-slate-200 dark:border-slate-900 py-10 text-center text-sm text-slate-500 bg-white dark:bg-slate-950">
          &copy; {new Date().getFullYear()} Kathan. All rights reserved. Built using React 18, Express, and MongoDB.
        </footer>
      </div>
    </div>
  );
}
