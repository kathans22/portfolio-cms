import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { testimonialSchema, TestimonialInput } from '@portfolio/shared';
import type { Testimonial } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { Plus, Edit2, Trash2, X, Check, Clock } from 'lucide-react';

export default function TestimonialsManager() {
  const queryClient = useQueryClient();
  const [currentModal, setCurrentModal] = useState<{ mode: 'add' | 'edit'; item?: Testimonial } | null>(null);

  // '/testimonials/all', not '/testimonials': the public route now filters PENDING
  // out, so the moderation queue would always look empty on the plain endpoint.
  const { data: testimonials } = useQuery<Testimonial[]>({
    queryKey: ['adminTestimonials'],
    queryFn: async () => (await apiFetch('/testimonials/all')).json(),
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<TestimonialInput>({
    resolver: zodResolver(testimonialSchema),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiFetch(`/testimonials/${id}`, { method: 'DELETE' }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminTestimonials'] }),
  });

  const saveMutation = useMutation<Testimonial, Error, TestimonialInput>({
    mutationFn: async (formData) => {
      const url = currentModal?.mode === 'add' ? '/testimonials' : `/testimonials/${currentModal?.item?.id}`;
      const method = currentModal?.mode === 'add' ? 'POST' : 'PATCH';
      const res = await apiFetch(url, { method, body: JSON.stringify(formData) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to save testimonial');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminTestimonials'] });
      setCurrentModal(null);
    },
    onError: (err) => alert(err.message),
  });

  const handleAddClick = () => {
    reset({ name: '', role: '', company: '', quote: '', avatarUrl: '', order: 0 });
    setCurrentModal({ mode: 'add' });
  };

  const handleEditClick = (item: Testimonial) => {
    reset(item);
    setCurrentModal({ mode: 'edit', item });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/testimonials/${id}/approve`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to approve testimonial');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminTestimonials'] }),
    onError: (err: Error) => alert(err.message),
  });

  const all = testimonials || [];
  const pending = all.filter((t) => t.status === 'PENDING');
  const sorted = all.filter((t) => t.status !== 'PENDING').sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6 text-slate-100">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Testimonials Manager</h1>
          <p className="text-slate-400 text-sm">Manage client and colleague testimonials shown on Home.</p>
        </div>
        <button onClick={handleAddClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
          <Plus size={16} /> Add Testimonial
        </button>
      </header>

      {/* Moderation queue — visitor submissions, invisible on the site until approved. */}
      {pending.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-amber-300">
            <Clock size={15} /> Awaiting review ({pending.length})
          </h2>
          <p className="mb-5 text-xs text-slate-400">
            Submitted from the public site. Nothing here is visible to visitors yet.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((t) => (
              <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                <p className="mb-4 text-sm italic text-slate-300">&quot;{t.quote}&quot;</p>
                <p className="text-sm font-bold text-white">{t.name}</p>
                <p className="text-xs text-slate-500">
                  {t.role}
                  {t.company ? ` at ${t.company}` : ''}
                </p>
                {t.email && <p className="mt-1 font-mono text-[11px] text-slate-500">{t.email}</p>}
                <div className="mt-4 flex gap-2 border-t border-slate-800 pt-4">
                  <button
                    onClick={() => approveMutation.mutate(t.id)}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    <Check size={13} /> Approve &amp; publish
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Reject and delete the submission from "${t.name}"?`)) deleteMutation.mutate(t.id);
                    }}
                    className="flex items-center gap-1.5 rounded bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sorted.map((t) => (
          <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
            <p className="text-slate-300 text-sm italic mb-4 flex-grow line-clamp-4">&quot;{t.quote}&quot;</p>
            <div className="flex items-center gap-3 mb-4">
              {t.avatarUrl ? (
                <img src={t.avatarUrl} referrerPolicy="no-referrer" alt="" loading="lazy" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-500">{t.name[0]}</div>
              )}
              <div>
                <p className="font-bold text-white text-sm">{t.name}</p>
                <p className="text-slate-500 text-xs">{t.role}{t.company ? ` at ${t.company}` : ''}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => handleEditClick(t)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"><Edit2 size={14} /></button>
              <button onClick={() => { if (confirm(`Delete testimonial from "${t.name}"?`)) deleteMutation.mutate(t.id); }} className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-slate-500 col-span-full text-center py-10">No testimonials yet.</p>
        )}
      </div>

      {currentModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button onClick={() => setCurrentModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
            <h3 className="text-xl font-bold text-white mb-6 capitalize">{currentModal.mode} Testimonial</h3>
            <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
              <div>
                <label htmlFor="testimonial-name" className="text-slate-400 text-xs font-semibold block mb-2">Name</label>
                <input id="testimonial-name" type="text" {...register('name')} className="input-field" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="testimonial-role" className="text-slate-400 text-xs font-semibold block mb-2">Role</label>
                  <input id="testimonial-role" type="text" {...register('role')} className="input-field" />
                  {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message as string}</p>}
                </div>
                <div>
                  <label htmlFor="testimonial-company" className="text-slate-400 text-xs font-semibold block mb-2">Company (optional)</label>
                  <input id="testimonial-company" type="text" {...register('company')} className="input-field" />
                </div>
              </div>
              <div>
                <label htmlFor="testimonial-quote" className="text-slate-400 text-xs font-semibold block mb-2">Quote</label>
                <textarea id="testimonial-quote" rows={4} {...register('quote')} className="input-field" />
                {errors.quote && <p className="text-red-500 text-xs mt-1">{errors.quote.message as string}</p>}
              </div>
              <Controller
                name="avatarUrl"
                control={control}
                render={({ field }) => <ImageUploadField value={field.value || ''} onChange={field.onChange} label="Avatar (optional)" />}
              />
              <div>
                <label htmlFor="testimonial-order" className="text-slate-400 text-xs font-semibold block mb-2">Order</label>
                <input id="testimonial-order" type="number" {...register('order', { valueAsNumber: true })} className="input-field" />
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                <button type="button" onClick={() => setCurrentModal(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm disabled:opacity-60">
                  {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
