import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { testimonialSubmissionSchema, TestimonialSubmissionInput } from '@portfolio/shared';
import { apiFetch } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { AlertCircle, CheckCircle2, PenLine, X } from 'lucide-react';

/**
 * Public "leave a testimonial" form.
 *
 * Nothing submitted here appears on the site: the server forces every submission to
 * PENDING and it stays invisible until it's approved in the admin. The copy says so
 * up front, so a visitor isn't surprised when their words don't show up immediately.
 */
export function TestimonialForm() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TestimonialSubmissionInput>({
    resolver: zodResolver(testimonialSubmissionSchema),
  });

  const mutation = useMutation<unknown, Error, TestimonialSubmissionInput>({
    mutationFn: async (formData) => {
      const res = await apiFetch('/testimonials/submit', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Failed to submit testimonial');
      }
      return res.json();
    },
    onSuccess: () => {
      reset();
      setSent(true);
      showToast('success', 'Thank you — your testimonial is in for review.');
    },
    onError: (err) => showToast('error', err.message),
  });

  if (sent) {
    return (
      <div className="mt-10 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-5">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">Thanks for writing that.</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            It&apos;s queued for review and will appear here once approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="testimonial-form"
        className="btn-ghost"
      >
        {open ? <X size={15} /> : <PenLine size={15} />}
        {open ? 'Cancel' : 'Worked with me? Leave a testimonial'}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="testimonial-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <form
              onSubmit={handleSubmit((data) => mutation.mutate(data))}
              noValidate
              className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800/80 dark:bg-slate-900/40 sm:p-8"
            >
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                Submissions are reviewed before they&apos;re published. Your email stays
                private — it&apos;s only so I can check who wrote it.
              </p>

              {/* Honeypot: hidden from real users, bots that auto-fill forms often populate it */}
              <input
                type="text"
                {...register('website')}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="t-name" label="Your name" error={errors.name?.message}>
                  <input id="t-name" type="text" {...register('name')} className="form-input" placeholder="Jane Doe" />
                </Field>
                <Field id="t-email" label="Email" error={errors.email?.message}>
                  <input id="t-email" type="email" {...register('email')} className="form-input" placeholder="jane@company.com" />
                </Field>
                <Field id="t-role" label="Your role" error={errors.role?.message}>
                  <input id="t-role" type="text" {...register('role')} className="form-input" placeholder="Engineering Manager" />
                </Field>
                <Field id="t-company" label="Company (optional)" error={errors.company?.message}>
                  <input id="t-company" type="text" {...register('company')} className="form-input" placeholder="Acme Inc." />
                </Field>
              </div>

              <div className="mt-5">
                <Field id="t-quote" label="Your testimonial" error={errors.quote?.message}>
                  <textarea
                    id="t-quote"
                    rows={5}
                    {...register('quote')}
                    className="form-input"
                    placeholder="What was it like working together?"
                  />
                </Field>
              </div>

              {mutation.isError && (
                <div className="mt-4 flex items-center gap-2 text-sm text-red-500 dark:text-red-400" role="alert">
                  <AlertCircle size={16} /> {mutation.error.message}
                </div>
              )}

              <button type="submit" disabled={mutation.isPending} className="btn-primary mt-6 disabled:opacity-60">
                {mutation.isPending ? 'Sending…' : 'Submit for review'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
