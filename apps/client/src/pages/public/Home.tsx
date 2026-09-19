import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { contactSchema, ContactInput } from '@portfolio/shared';
import type { Project, Skill, Testimonial, BlogPost } from '@portfolio/types';
import { CertificationList } from '../../components/public/CertificationList';
import { Hero } from '../../components/public/Hero';
import { CoreTechnology } from '../../components/public/CoreTechnology';
import { ProjectShowcase } from '../../components/public/ProjectShowcase';
import { TestimonialsSection } from '../../components/public/TestimonialsSection';
import { apiFetch } from '../../lib/api';
import { Seo } from '../../components/ui/Seo';
import { useToast } from '../../hooks/useToast';
import {
  Mail, MapPin,
  AlertCircle
} from 'lucide-react';

// Small editorial kicker used above each section heading.
function Kicker({ children }: { index?: string; children: React.ReactNode }) {
  return (
    <span className="kicker flex items-center gap-2.5">
      <span className="h-px w-8 bg-indigo-400/60 dark:bg-indigo-500/50" />
      {children}
    </span>
  );
}

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
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 dark:border-slate-800 border-t-indigo-500 mb-4" role="status" aria-label="Loading" />
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">loading</p>
      </div>
    );
  }


  return (
    <div className="relative overflow-hidden min-h-screen text-slate-700 dark:text-slate-100 pb-20">
      <Seo title="Kathan Shah | Portfolio" path="/" personSchema />

      <Hero />

      {/* Credentials sit high on the page: recruiters scan the home page first, and
          third-party validation shouldn't be three routes deep. */}
      <CertificationList layoutVariant="compact" limit={6} />

      {/* About blurb */}
      <motion.section {...fadeInUp} className="container-wide py-20 border-t border-slate-200 dark:border-slate-900">
        <h2 className="max-w-4xl font-heading text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 dark:text-white md:text-6xl">
          Got a messy problem?{' '}
          <span className="text-indigo-600 dark:text-indigo-400">I ship the clean solution.</span>
        </h2>
        <p className="mt-8 max-w-3xl text-lg md:text-2xl leading-relaxed text-slate-600 dark:text-slate-300 font-heading font-medium tracking-tight">
          Full-stack developer building ERP platforms and multi-tenant commerce systems.
          My latest carries 1.4M+ orders and 30,000+ products, and I built the
          interfaces the team uses to run it.
        </p>
        <Link to="/about" className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:gap-2.5 transition-all">
          More about me &rarr;
        </Link>
      </motion.section>

      <ProjectShowcase projects={projects} />

      <CoreTechnology skills={skills} />

      {/* Blogs Brief */}
      {blogs && blogs.length > 0 && (
        <motion.section {...fadeInUp} id="blog" className="container-wide py-24 border-t border-slate-200 dark:border-slate-900">
          <div className="flex flex-wrap justify-between items-end gap-4 mb-12">
            <div>
              <Kicker index="03">Writing</Kicker>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-2 text-slate-900 dark:text-white">Latest insights</h2>
              <p className="text-slate-500 dark:text-slate-400">Guides, logs, and workflow reviews.</p>
            </div>
            <Link to="/blog" className="group inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              All posts <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
            </Link>
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
                    <img src={blog.coverImageUrl} referrerPolicy="no-referrer" alt="" loading="lazy" className="w-full h-full object-cover" />
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

      <TestimonialsSection testimonials={testimonials} />

      {/* Contact Form Section */}
      <motion.section {...fadeInUp} id="contact" className="container-wide py-24 border-t border-slate-200 dark:border-slate-900">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <Kicker index="05">Contact</Kicker>
            <h2 className="text-3xl font-bold mt-3 mb-4 text-slate-900 dark:text-white">Let&apos;s connect</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              If you have a role opportunity, project, or simply want to say hello, submit the form here or send a message directly.
            </p>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Mail size={18} />
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Email</span>
                  <a href="mailto:kathanshah.work@yahoo.com" className="font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">kathanshah.work@yahoo.com</a>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <MapPin size={18} />
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Based in</span>
                  <span className="font-semibold text-slate-900 dark:text-white">Surat, India</span>
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

              <button type="submit" className="btn-primary w-full py-3 disabled:opacity-60" disabled={contactMutation.isPending}>
                {contactMutation.isPending ? 'Sending…' : 'Send message'}
              </button>
            </form>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
