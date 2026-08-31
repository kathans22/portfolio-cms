import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { contactSchema, ContactInput } from '@portfolio/shared';
import type { Project, Skill, Testimonial, BlogPost } from '@portfolio/types';
import { SkillCertificationBadge } from '../../components/public/SkillCertificationBadge';
import { CertificationList } from '../../components/public/CertificationList';
import { apiFetch } from '../../lib/api';
import { Seo } from '../../components/ui/Seo';
import { useToast } from '../../hooks/useToast';
import {
  Award, Mail, MapPin,
  MessageSquare, Github, ExternalLink, AlertCircle
} from 'lucide-react';

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5 },
};

export default function Home() {
  const { showToast } = useToast();

  // Queries
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiFetch('/projects');
      return res.json();
    }
  });

  const { data: skills } = useQuery<Skill[]>({
    queryKey: ['skills', 'withCertifications'],
    queryFn: async () => {
      // Opt in to the certification join — this page renders credential badges.
      const res = await apiFetch('/skills?withCertifications=true');
      return res.json();
    }
  });

  const { data: testimonials } = useQuery<Testimonial[]>({
    queryKey: ['testimonials'],
    queryFn: async () => {
      const res = await apiFetch('/testimonials');
      return res.json();
    }
  });

  const { data: blogs } = useQuery<BlogPost[]>({
    queryKey: ['blogs'],
    queryFn: async () => {
      const res = await apiFetch('/blog');
      return res.json();
    }
  });

  // Track pageview analytics
  useEffect(() => {
    apiFetch('/analytics', {
      method: 'POST',
      body: JSON.stringify({ path: '/' }),
    }).catch(() => {});
  }, []);

  // Form submission handling
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema)
  });

  const contactMutation = useMutation<unknown, Error, ContactInput>({
    mutationFn: async (formData) => {
      const res = await apiFetch('/contact', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to submit contact request');
      }
      return res.json();
    },
    onSuccess: () => {
      reset();
      showToast('success', "Message sent — I'll get back to you soon!");
    },
    onError: (err) => {
      showToast('error', err.message || 'Failed to submit contact request');
    },
  });

  const onSubmit = (data: ContactInput) => {
    contactMutation.mutate(data);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

  if (projectsLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4" role="status" aria-label="Loading" />
        <p className="font-heading text-lg">Loading Portfolio Showcase...</p>
      </div>
    );
  }

  const skillsByCategory = skills?.reduce((acc: Record<string, Skill[]>, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {}) || {};

  return (
    <div className="relative overflow-hidden min-h-screen text-slate-700 dark:text-slate-100 pb-20">
      <Seo title="Kathan — Portfolio" path="/" personSchema />

      {/* Dynamic Background Glows */}
      <div className="absolute top-[10%] left-[-100px] w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-100px] w-96 h-96 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-32 pb-24 md:pt-40">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold tracking-wider text-sm uppercase mb-4 block">
              Full-Stack Developer & Architect
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight text-slate-900 dark:text-white">
              Hi, I&apos;m <span className="text-gradient">Kathan</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg md:text-xl mb-8 max-w-xl leading-relaxed">
              I build production-grade TypeScript applications, responsive user interfaces, and robust server architectures across software, AI, and data engineering.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/contact" className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg hover:shadow-indigo-500/20 transition-all">
                Let&apos;s Work Together
              </Link>
              <Link to="/projects" className="px-6 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 transition-colors">
                View My Projects
              </Link>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-center"
          >
            <div className="w-80 h-80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl float-animation">
              <img
                src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80"
                alt="Developer workspace with multiple monitors showing code"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Credentials sit high on the page: recruiters scan the home page first, and
          third-party validation shouldn't be three routes deep. */}
      <CertificationList layoutVariant="compact" limit={6} />

      {/* About blurb */}
      <motion.section {...fadeInUp} className="max-w-4xl mx-auto px-6 py-16 border-t border-slate-200 dark:border-slate-900 text-center">
        <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed">
          Over 6+ years I&apos;ve engineered server frameworks for analytics platforms, scaled document-oriented database structures, and built interactive editor interfaces — across software development, AI engineering, and data engineering.
          {' '}
          <Link to="/about" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold whitespace-nowrap">
            More about me &rarr;
          </Link>
        </p>
      </motion.section>

      {/* Projects list */}
      <motion.section {...fadeInUp} id="projects" className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-200 dark:border-slate-900">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2 text-slate-900 dark:text-white">Selected Work</h2>
            <p className="text-slate-500 dark:text-slate-400">Handpicked projects demonstrating API scalability and client design.</p>
          </div>
          <Link to="/projects" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold text-sm">View all &rarr;</Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects?.slice(0, 3).map((project) => (
            <div key={project.id} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden flex flex-col group hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="h-48 overflow-hidden relative">
                <img src={project.coverImageUrl} alt={project.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {project.featured && (
                  <span className="absolute top-4 left-4 bg-indigo-600 text-white text-xs px-2.5 py-1 rounded-full font-semibold">
                    Featured
                  </span>
                )}
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-xl font-bold mb-3 line-clamp-2 text-slate-900 dark:text-white">{project.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 line-clamp-3">{project.summary}</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {project.techStack.map((tag) => (
                    <span key={tag} className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-1 rounded-md">{tag}</span>
                  ))}
                </div>
                <div className="flex-grow" />
                <div className="flex items-center justify-between mt-auto">
                  <Link to={`/projects/${project.slug}`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 text-sm font-semibold flex items-center gap-1">
                    Read Details &rarr;
                  </Link>
                  <div className="flex gap-3 text-slate-500 dark:text-slate-400">
                    {project.repoUrl && <a href={project.repoUrl} target="_blank" rel="noreferrer" aria-label={`${project.title} repository`} className="hover:text-indigo-500 dark:hover:text-indigo-400"><Github size={18} /></a>}
                    {project.liveUrl && <a href={project.liveUrl} target="_blank" rel="noreferrer" aria-label={`${project.title} live demo`} className="hover:text-indigo-500 dark:hover:text-indigo-400"><ExternalLink size={18} /></a>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Skills preview */}
      <motion.section {...fadeInUp} id="skills" className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-200 dark:border-slate-900">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2 text-slate-900 dark:text-white">Core Technology</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">Expertise and frameworks used in production pipelines.</p>
          </div>
          <Link to="/about" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold text-sm">Full skill set &rarr;</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {Object.entries(skillsByCategory).map(([category, list]) => (
            <div key={category} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-8 rounded-xl">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Award size={20} /> {category}
              </h3>
              <div className="space-y-6">
                {list.map((skill) => (
                  <div key={skill.id} id={`skill-${skill.id}`} className="scroll-mt-28">
                    <div className="flex justify-between items-center gap-2 text-sm mb-2 font-medium">
                      <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{skill.name}</span>
                        <SkillCertificationBadge skillName={skill.name} certifications={skill.certifications ?? []} />
                      </span>
                      {!skill.hideLevel && <span className="text-slate-500 dark:text-slate-400 shrink-0">{skill.level}/5</span>}
                    </div>
                    {/* Self-rating suppressed where a credential speaks for itself. */}
                    {!skill.hideLevel && (
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${(skill.level / 5) * 100}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Blogs Brief */}
      {blogs && blogs.length > 0 && (
        <motion.section {...fadeInUp} id="blog" className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-200 dark:border-slate-900">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2 text-slate-900 dark:text-white">Latest Insights</h2>
              <p className="text-slate-500 dark:text-slate-400">Guides, logs, and workflow reviews.</p>
            </div>
            <Link to="/blog" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold text-sm">View all &rarr;</Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogs.slice(0, 3).map((blog) => (
              <Link
                key={blog.id}
                to={`/blog/${blog.slug}`}
                className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col"
              >
                {blog.coverImageUrl && (
                  <div className="h-48 overflow-hidden">
                    <img src={blog.coverImageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-grow">
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 mb-2 block">{formatDate(blog.publishedAt)}</span>
                  <h3 className="text-lg font-bold mb-3 line-clamp-2 text-slate-900 dark:text-white">{blog.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 line-clamp-3">{blog.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* Testimonials */}
      {testimonials && testimonials.length > 0 && (
        <motion.section {...fadeInUp} id="testimonials" className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-200 dark:border-slate-900">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-slate-900 dark:text-white">Testimonials</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map((t) => (
              <div key={t.id} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-8 rounded-xl flex flex-col">
                <MessageSquare size={24} className="text-indigo-500 mb-6" />
                <p className="text-slate-600 dark:text-slate-300 italic mb-8 flex-grow">&quot;{t.quote}&quot;</p>
                <div className="flex items-center gap-4">
                  {t.avatarUrl ? (
                    <img src={t.avatarUrl} alt="" loading="lazy" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-500 text-lg">
                      {t.name[0]}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</h4>
                    <p className="text-slate-500 text-xs">{t.role}{t.company ? ` at ${t.company}` : ''}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Contact Form Section */}
      <motion.section {...fadeInUp} id="contact" className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-200 dark:border-slate-900">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">Let&apos;s Connect</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              If you have a role opportunity, project, or simply want to say hello, submit the form here or send a message directly.
            </p>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Mail size={18} />
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Email Address</span>
                  <span className="font-semibold text-slate-900 dark:text-white">admin@portfolio.com</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <MapPin size={18} />
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Location</span>
                  <span className="font-semibold text-slate-900 dark:text-white">San Francisco, CA</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-8 rounded-xl">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
              {/* Honeypot: hidden from real users, bots that auto-fill forms often populate it */}
              <input type="text" {...register('website')} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <div>
                <label htmlFor="home-name" className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase block mb-2">Name</label>
                <input id="home-name" type="text" {...register('name')} className="form-input" placeholder="John Doe" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'home-name-error' : undefined} />
                {errors.name && <p id="home-name-error" className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
              </div>
              <div>
                <label htmlFor="home-email" className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase block mb-2">Email</label>
                <input id="home-email" type="email" {...register('email')} className="form-input" placeholder="john@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'home-email-error' : undefined} />
                {errors.email && <p id="home-email-error" className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>}
              </div>
              <div>
                <label htmlFor="home-subject" className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase block mb-2">Subject</label>
                <input id="home-subject" type="text" {...register('subject')} className="form-input" placeholder="Freelance Role" aria-invalid={!!errors.subject} aria-describedby={errors.subject ? 'home-subject-error' : undefined} />
                {errors.subject && <p id="home-subject-error" className="text-red-500 text-xs mt-1">{errors.subject.message as string}</p>}
              </div>
              <div>
                <label htmlFor="home-message" className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase block mb-2">Message</label>
                <textarea id="home-message" rows={4} {...register('message')} className="form-input" placeholder="Describe the role details..." aria-invalid={!!errors.message} aria-describedby={errors.message ? 'home-message-error' : undefined} />
                {errors.message && <p id="home-message-error" className="text-red-500 text-xs mt-1">{errors.message.message as string}</p>}
              </div>

              {contactMutation.isError && (
                <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-sm" role="alert">
                  <AlertCircle size={16} /> {contactMutation.error.message}
                </div>
              )}

              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-white transition-colors disabled:opacity-60" disabled={contactMutation.isPending}>
                {contactMutation.isPending ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
