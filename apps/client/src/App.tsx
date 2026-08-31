import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { AnimatePresence } from 'framer-motion';

// Layouts
import { PublicLayout } from './layouts/PublicLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { RequireAuth } from './routes/RequireAuth';
import { ToastContainer } from './components/ui/ToastContainer';
import { RouteLoading } from './components/ui/RouteLoading';

// Public Pages — lazy-loaded so each route only ships the JS it needs.
const Home = lazy(() => import('./pages/public/Home'));
const Projects = lazy(() => import('./pages/public/Projects'));
const ProjectDetail = lazy(() => import('./pages/public/ProjectDetail'));
const About = lazy(() => import('./pages/public/About'));
const Blog = lazy(() => import('./pages/public/Blog'));
const CertificationsPage = lazy(() => import('./pages/public/Certifications'));
const Resolver = lazy(() => import('./pages/public/Resolver'));
const BlogPost = lazy(() => import('./pages/public/BlogPost'));
const Contact = lazy(() => import('./pages/public/Contact'));

// Admin Pages
const Login = lazy(() => import('./pages/admin/Login'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const ProjectsManager = lazy(() => import('./pages/admin/ProjectsManager'));
const BlogManager = lazy(() => import('./pages/admin/BlogManager'));
const SkillsManager = lazy(() => import('./pages/admin/SkillsManager'));
const CertificationsManager = lazy(() => import('./pages/admin/CertificationsManager'));
const PagesManager = lazy(() => import('./pages/admin/PagesManager'));
const PageEditor = lazy(() => import('./pages/admin/PageEditor'));
// ADMIN-ONLY module. Lazy so none of it reaches the public site's initial bundle.
const ResourcesManager = lazy(() => import('./pages/admin/ResourcesManager'));
const MainTypesManager = lazy(() => import('./pages/admin/MainTypesManager'));
const SubTypesManager = lazy(() => import('./pages/admin/SubTypesManager'));
const ExperienceManager = lazy(() => import('./pages/admin/ExperienceManager'));
const TestimonialsManager = lazy(() => import('./pages/admin/TestimonialsManager'));
const MessagesInbox = lazy(() => import('./pages/admin/MessagesInbox'));
const MediaLibrary = lazy(() => import('./pages/admin/MediaLibrary'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const Settings = lazy(() => import('./pages/admin/Settings'));

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteLoading />}>
        <Routes location={location} key={location.pathname}>
          {/* Public Routes tree */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/projects" element={<PublicLayout><Projects /></PublicLayout>} />
          <Route path="/projects/:slug" element={<PublicLayout><ProjectDetail /></PublicLayout>} />
          <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
          <Route path="/certifications" element={<PublicLayout><CertificationsPage /></PublicLayout>} />
          <Route path="/blog" element={<PublicLayout><Blog /></PublicLayout>} />
          <Route path="/blog/:slug" element={<PublicLayout><BlogPost /></PublicLayout>} />
          <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />

          {/* Admin Login (Isolated View) */}
          <Route path="/admin/login" element={<Login />} />

          {/* Protected Admin CMS Routing Group */}
          <Route
            path="/admin/dashboard"
            element={<RequireAuth><AdminLayout><Dashboard /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/projects"
            element={<RequireAuth><AdminLayout><ProjectsManager /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/blogs"
            element={<RequireAuth><AdminLayout><BlogManager /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/skills"
            element={<RequireAuth><AdminLayout><SkillsManager /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/pages"
            element={<RequireAuth><AdminLayout><PagesManager /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/pages/:id"
            element={<RequireAuth><AdminLayout><PageEditor /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/resources"
            element={<RequireAuth><AdminLayout><ResourcesManager /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/main-types"
            element={<RequireAuth><AdminLayout><MainTypesManager /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/sub-types"
            element={<RequireAuth><AdminLayout><SubTypesManager /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/certifications"
            element={<RequireAuth><AdminLayout><CertificationsManager /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/experience"
            element={<RequireAuth><AdminLayout><ExperienceManager /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/testimonials"
            element={<RequireAuth><AdminLayout><TestimonialsManager /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/messages"
            element={<RequireAuth><AdminLayout><MessagesInbox /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/media"
            element={<RequireAuth><AdminLayout><MediaLibrary /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/analytics"
            element={<RequireAuth><AdminLayout><Analytics /></AdminLayout></RequireAuth>}
          />
          <Route
            path="/admin/settings"
            element={<RequireAuth><AdminLayout><Settings /></AdminLayout></RequireAuth>}
          />

          {/* Catch-all: the server resolver owns every URL the hardcoded routes above
              didn't claim, so admin-created pages work without a deploy. It replaces a
              blanket redirect to home, which turned every unknown URL into a soft 404
              that search engines index as duplicate content. */}
          <Route path="*" element={<PublicLayout><Resolver /></PublicLayout>} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AnimatedRoutes />
          <ToastContainer />
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
