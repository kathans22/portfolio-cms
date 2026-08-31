import React, { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { contactSchema, ContactInput } from '@portfolio/shared';
import { apiFetch } from '../../lib/api';
import { Seo } from '../../components/ui/Seo';
import { useToast } from '../../hooks/useToast';
import { Mail, MapPin, AlertCircle } from 'lucide-react';

export default function Contact() {
  const { showToast } = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
  });

  useEffect(() => {
    apiFetch('/analytics', {
      method: 'POST',
      body: JSON.stringify({ path: '/contact' }),
    }).catch(() => {});
  }, []);

  const contactMutation = useMutation<unknown, Error, ContactInput>({
    mutationFn: async (formData) => {
      const res = await apiFetch('/contact', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to submit inquiry');
      }
      return res.json();
    },
    onSuccess: () => {
      reset();
      showToast('success', "Message sent — I'll get back to you soon!");
    },
    onError: (err) => {
      showToast('error', err.message || 'Failed to submit inquiry');
    },
  });

  const onSubmit = (data: ContactInput) => {
    contactMutation.mutate(data);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-32 pb-24 text-slate-700 dark:text-slate-100 min-h-screen">
      <Seo title="Contact" description="Get in touch about freelance opportunities, projects, or collaborations." path="/contact" />

      <div className="grid md:grid-cols-2 gap-12">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 text-slate-900 dark:text-white">Let&apos;s Connect</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
            If you have a freelance opportunity, project, or simply want to say hello, submit the form here or send a message directly.
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-8 rounded-xl"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {/* Honeypot: hidden from real users, bots that auto-fill forms often populate it */}
            <input type="text" {...register('website')} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <div>
              <label htmlFor="contact-name" className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase block mb-2">Name</label>
              <input id="contact-name" type="text" {...register('name')} className="form-input" placeholder="John Doe" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'contact-name-error' : undefined} />
              {errors.name && <p id="contact-name-error" className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
            </div>
            <div>
              <label htmlFor="contact-email" className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase block mb-2">Email</label>
              <input id="contact-email" type="email" {...register('email')} className="form-input" placeholder="john@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'contact-email-error' : undefined} />
              {errors.email && <p id="contact-email-error" className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>}
            </div>
            <div>
              <label htmlFor="contact-subject" className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase block mb-2">Subject</label>
              <input id="contact-subject" type="text" {...register('subject')} className="form-input" placeholder="Freelance Opportunity" aria-invalid={!!errors.subject} aria-describedby={errors.subject ? 'contact-subject-error' : undefined} />
              {errors.subject && <p id="contact-subject-error" className="text-red-500 text-xs mt-1">{errors.subject.message as string}</p>}
            </div>
            <div>
              <label htmlFor="contact-message" className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase block mb-2">Message</label>
              <textarea id="contact-message" rows={5} {...register('message')} className="form-input" placeholder="Describe the details..." aria-invalid={!!errors.message} aria-describedby={errors.message ? 'contact-message-error' : undefined} />
              {errors.message && <p id="contact-message-error" className="text-red-500 text-xs mt-1">{errors.message.message as string}</p>}
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
        </motion.div>
      </div>
    </div>
  );
}
