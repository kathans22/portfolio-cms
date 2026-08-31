import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { experienceSchema, educationSchema, ExperienceInput, EducationInput, PROJECT_DOMAIN_META, ProjectDomain } from '@portfolio/shared';
import type { Experience, Education } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { DomainMultiSelect } from '../../components/admin/DomainMultiSelect';
import { useDragReorder } from '../../hooks/useDragReorder';
import { Plus, Edit2, Trash2, X, GripVertical } from 'lucide-react';

type Tab = 'work' | 'education';

function toDateInputValue(value?: string) {
  return value ? new Date(value).toISOString().split('T')[0] : '';
}

function ExperienceTab() {
  const queryClient = useQueryClient();
  const [currentModal, setCurrentModal] = useState<{ mode: 'add' | 'edit'; item?: Experience } | null>(null);

  const { data: experiences } = useQuery<Experience[]>({
    queryKey: ['adminExperience'],
    queryFn: async () => (await apiFetch('/experience')).json(),
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ExperienceInput>({
    resolver: zodResolver(experienceSchema),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiFetch(`/experience/${id}`, { method: 'DELETE' }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminExperience'] }),
  });

  const saveMutation = useMutation<Experience, Error, ExperienceInput>({
    mutationFn: async (formData) => {
      const url = currentModal?.mode === 'add' ? '/experience' : `/experience/${currentModal?.item?.id}`;
      const method = currentModal?.mode === 'add' ? 'POST' : 'PATCH';
      const res = await apiFetch(url, { method, body: JSON.stringify(formData) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to save experience');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminExperience'] });
      setCurrentModal(null);
    },
    onError: (err) => alert(err.message),
  });

  const handleAddClick = () => {
    reset({ company: '', role: '', domains: [], startDate: '', endDate: '', isCurrent: false, description: '', order: 0 });
    setCurrentModal({ mode: 'add' });
  };

  const handleEditClick = (item: Experience) => {
    reset({
      ...item,
      startDate: toDateInputValue(item.startDate),
      endDate: toDateInputValue(item.endDate),
    });
    setCurrentModal({ mode: 'edit', item });
  };

  const sorted = [...(experiences || [])].sort((a, b) => a.order - b.order);

  const reorderMutation = useMutation({
    mutationFn: async (reordered: Experience[]) => {
      await Promise.all(
        reordered.map((item, index) =>
          item.order === index ? null : apiFetch(`/experience/${item.id}`, { method: 'PATCH', body: JSON.stringify({ ...item, order: index }) })
        )
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminExperience'] }),
  });

  const { dragIndex, overIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useDragReorder(sorted, (reordered) => reorderMutation.mutate(reordered));

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={handleAddClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
          <Plus size={16} /> Add Experience
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="p-4 w-10"></th>
              <th className="p-4">Role</th>
              <th className="p-4">Company</th>
              <th className="p-4">Domains</th>
              <th className="p-4">Dates</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((exp, index) => (
              <tr
                key={exp.id}
                draggable
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`border-b border-slate-800 last:border-0 hover:bg-slate-950/20 cursor-grab active:cursor-grabbing ${dragIndex === index ? 'opacity-40' : ''} ${overIndex === index && dragIndex !== index ? 'border-t-2 border-t-indigo-500' : ''}`}
              >
                <td className="p-4 text-slate-600"><GripVertical size={16} /></td>
                <td className="p-4 font-bold text-white">{exp.role}</td>
                <td className="p-4 text-slate-400">{exp.company}</td>
                <td className="p-4 text-xs text-slate-400">{exp.domains.map((d: ProjectDomain) => PROJECT_DOMAIN_META[d]?.label ?? d).join(', ')}</td>
                <td className="p-4 text-xs text-slate-400">
                  {new Date(exp.startDate).toLocaleDateString()} — {exp.isCurrent ? 'Present' : (exp.endDate ? new Date(exp.endDate).toLocaleDateString() : 'N/A')}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleEditClick(exp)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"><Edit2 size={14} /></button>
                    <button onClick={() => { if (confirm(`Delete "${exp.role} at ${exp.company}"?`)) deleteMutation.mutate(exp.id); }} className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-slate-500">No experience entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {currentModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button onClick={() => setCurrentModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
            <h3 className="text-xl font-bold text-white mb-6 capitalize">{currentModal.mode} Experience</h3>
            <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
              <div>
                <label htmlFor="exp-role" className="text-slate-400 text-xs font-semibold block mb-2">Role</label>
                <input id="exp-role" type="text" {...register('role')} className="input-field" />
                {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message as string}</p>}
              </div>
              <div>
                <label htmlFor="exp-company" className="text-slate-400 text-xs font-semibold block mb-2">Company</label>
                <input id="exp-company" type="text" {...register('company')} className="input-field" />
                {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company.message as string}</p>}
              </div>
              <Controller
                name="domains"
                control={control}
                render={({ field }) => <DomainMultiSelect value={field.value || []} onChange={field.onChange} />}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="exp-start" className="text-slate-400 text-xs font-semibold block mb-2">Start Date</label>
                  <input id="exp-start" type="date" {...register('startDate')} className="input-field" />
                  {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message as string}</p>}
                </div>
                <div>
                  <label htmlFor="exp-end" className="text-slate-400 text-xs font-semibold block mb-2">End Date</label>
                  <input id="exp-end" type="date" {...register('endDate')} className="input-field" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="exp-current" type="checkbox" {...register('isCurrent')} className="rounded border-slate-800 bg-slate-950" />
                <label htmlFor="exp-current" className="text-slate-400 text-xs font-semibold">Current role</label>
              </div>
              <div>
                <label htmlFor="exp-description" className="text-slate-400 text-xs font-semibold block mb-2">Description</label>
                <textarea id="exp-description" rows={4} {...register('description')} className="input-field" />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message as string}</p>}
              </div>
              <div>
                <label htmlFor="exp-order" className="text-slate-400 text-xs font-semibold block mb-2">Order</label>
                <input id="exp-order" type="number" {...register('order', { valueAsNumber: true })} className="input-field" />
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
    </>
  );
}

function EducationTab() {
  const queryClient = useQueryClient();
  const [currentModal, setCurrentModal] = useState<{ mode: 'add' | 'edit'; item?: Education } | null>(null);

  const { data: educations } = useQuery<Education[]>({
    queryKey: ['adminEducation'],
    queryFn: async () => (await apiFetch('/education')).json(),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EducationInput>({
    resolver: zodResolver(educationSchema),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiFetch(`/education/${id}`, { method: 'DELETE' }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminEducation'] }),
  });

  const saveMutation = useMutation<Education, Error, EducationInput>({
    mutationFn: async (formData) => {
      const url = currentModal?.mode === 'add' ? '/education' : `/education/${currentModal?.item?.id}`;
      const method = currentModal?.mode === 'add' ? 'POST' : 'PATCH';
      const res = await apiFetch(url, { method, body: JSON.stringify(formData) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to save education record');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEducation'] });
      setCurrentModal(null);
    },
    onError: (err) => alert(err.message),
  });

  const handleAddClick = () => {
    reset({ institution: '', degree: '', startDate: '', endDate: '', description: '', order: 0 });
    setCurrentModal({ mode: 'add' });
  };

  const handleEditClick = (item: Education) => {
    reset({
      ...item,
      startDate: toDateInputValue(item.startDate),
      endDate: toDateInputValue(item.endDate),
    });
    setCurrentModal({ mode: 'edit', item });
  };

  const sorted = [...(educations || [])].sort((a, b) => a.order - b.order);

  const reorderMutation = useMutation({
    mutationFn: async (reordered: Education[]) => {
      await Promise.all(
        reordered.map((item, index) =>
          item.order === index ? null : apiFetch(`/education/${item.id}`, { method: 'PATCH', body: JSON.stringify({ ...item, order: index }) })
        )
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminEducation'] }),
  });

  const { dragIndex, overIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useDragReorder(sorted, (reordered) => reorderMutation.mutate(reordered));

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={handleAddClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
          <Plus size={16} /> Add Education
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="p-4 w-10"></th>
              <th className="p-4">Degree</th>
              <th className="p-4">Institution</th>
              <th className="p-4">Dates</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((edu, index) => (
              <tr
                key={edu.id}
                draggable
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`border-b border-slate-800 last:border-0 hover:bg-slate-950/20 cursor-grab active:cursor-grabbing ${dragIndex === index ? 'opacity-40' : ''} ${overIndex === index && dragIndex !== index ? 'border-t-2 border-t-indigo-500' : ''}`}
              >
                <td className="p-4 text-slate-600"><GripVertical size={16} /></td>
                <td className="p-4 font-bold text-white">{edu.degree}</td>
                <td className="p-4 text-slate-400">{edu.institution}</td>
                <td className="p-4 text-xs text-slate-400">
                  {new Date(edu.startDate).toLocaleDateString()} — {edu.endDate ? new Date(edu.endDate).toLocaleDateString() : 'N/A'}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleEditClick(edu)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"><Edit2 size={14} /></button>
                    <button onClick={() => { if (confirm(`Delete "${edu.degree}"?`)) deleteMutation.mutate(edu.id); }} className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-slate-500">No education entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {currentModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button onClick={() => setCurrentModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
            <h3 className="text-xl font-bold text-white mb-6 capitalize">{currentModal.mode} Education</h3>
            <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
              <div>
                <label htmlFor="edu-degree" className="text-slate-400 text-xs font-semibold block mb-2">Degree</label>
                <input id="edu-degree" type="text" {...register('degree')} className="input-field" />
                {errors.degree && <p className="text-red-500 text-xs mt-1">{errors.degree.message as string}</p>}
              </div>
              <div>
                <label htmlFor="edu-institution" className="text-slate-400 text-xs font-semibold block mb-2">Institution</label>
                <input id="edu-institution" type="text" {...register('institution')} className="input-field" />
                {errors.institution && <p className="text-red-500 text-xs mt-1">{errors.institution.message as string}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edu-start" className="text-slate-400 text-xs font-semibold block mb-2">Start Date</label>
                  <input id="edu-start" type="date" {...register('startDate')} className="input-field" />
                  {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message as string}</p>}
                </div>
                <div>
                  <label htmlFor="edu-end" className="text-slate-400 text-xs font-semibold block mb-2">End Date</label>
                  <input id="edu-end" type="date" {...register('endDate')} className="input-field" />
                </div>
              </div>
              <div>
                <label htmlFor="edu-description" className="text-slate-400 text-xs font-semibold block mb-2">Description (optional)</label>
                <textarea id="edu-description" rows={3} {...register('description')} className="input-field" />
              </div>
              <div>
                <label htmlFor="edu-order" className="text-slate-400 text-xs font-semibold block mb-2">Order</label>
                <input id="edu-order" type="number" {...register('order', { valueAsNumber: true })} className="input-field" />
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
    </>
  );
}

export default function ExperienceManager() {
  const [tab, setTab] = useState<Tab>('work');

  return (
    <div className="space-y-6 text-slate-100">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-white">Experience &amp; Education</h1>
        <p className="text-slate-400 text-sm">Manage your work history and education timelines.</p>
      </header>

      <div className="flex gap-2 border-b border-slate-800">
        <button
          onClick={() => setTab('work')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'work' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          Work History
        </button>
        <button
          onClick={() => setTab('education')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'education' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
        >
          Education
        </button>
      </div>

      {tab === 'work' ? <ExperienceTab /> : <EducationTab />}
    </div>
  );
}
