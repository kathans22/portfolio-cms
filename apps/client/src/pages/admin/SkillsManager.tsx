import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { skillSchema, SkillInput, PROJECT_DOMAIN_META, ProjectDomain } from '@portfolio/shared';
import type { Skill, Certification } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { DomainMultiSelect } from '../../components/admin/DomainMultiSelect';
import { useDragReorder } from '../../hooks/useDragReorder';
import { Plus, Edit2, Trash2, X, GripVertical, BadgeCheck } from 'lucide-react';

export default function SkillsManager() {
  const queryClient = useQueryClient();
  const [currentModal, setCurrentModal] = useState<{ mode: 'add' | 'edit'; item?: Skill } | null>(null);

  const { data: skills } = useQuery<Skill[]>({
    queryKey: ['adminSkills'],
    queryFn: async () => (await apiFetch('/skills')).json(),
  });

  // One request for the whole table rather than a per-row lookup. Uses the admin list
  // so drafts and expired credentials still count toward the reference total.
  const { data: certifications } = useQuery<Certification[]>({
    queryKey: ['adminCertifications'],
    queryFn: async () => (await apiFetch('/admin/certifications')).json(),
  });

  const certCountBySkillId = new Map<string, number>();
  for (const certification of certifications ?? []) {
    for (const skillId of certification.skillIds) {
      certCountBySkillId.set(skillId, (certCountBySkillId.get(skillId) ?? 0) + 1);
    }
  }

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<SkillInput>({
    resolver: zodResolver(skillSchema),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/skills/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSkills'] });
      // Deleting a skill strips it from every certification that referenced it.
      queryClient.invalidateQueries({ queryKey: ['adminCertifications'] });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });

  // Deleting a skill silently rewrites every certification that referenced it, so the
  // count is fetched fresh at delete time and named in the prompt. A silent cascade is
  // worse than a loud one.
  const handleDeleteClick = async (skill: Skill) => {
    let referencing: Certification[] = [];
    try {
      const res = await apiFetch(`/admin/skills/${skill.id}/certifications`);
      if (res.ok) referencing = await res.json();
    } catch {
      // Fall through to a plain confirm rather than blocking the delete on a
      // failed count lookup.
    }

    const warning = referencing.length
      ? `\n\n${referencing.length} certification${referencing.length === 1 ? '' : 's'} reference this skill; the mapping will be removed:\n` +
        referencing.map((cert) => `  • ${cert.name}`).join('\n')
      : '';

    if (confirm(`Delete "${skill.name}"?${warning}`)) {
      deleteMutation.mutate(skill.id);
    }
  };

  const saveMutation = useMutation<Skill, Error, SkillInput>({
    mutationFn: async (formData) => {
      const url = currentModal?.mode === 'add' ? '/skills' : `/skills/${currentModal?.item?.id}`;
      const method = currentModal?.mode === 'add' ? 'POST' : 'PATCH';
      const res = await apiFetch(url, { method, body: JSON.stringify(formData) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to save skill');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSkills'] });
      setCurrentModal(null);
    },
    onError: (err) => alert(err.message),
  });

  const handleAddClick = () => {
    reset({ name: '', category: '', domains: [], level: 3, hideLevel: false, order: 0 });
    setCurrentModal({ mode: 'add' });
  };

  const handleEditClick = (item: Skill) => {
    reset(item);
    setCurrentModal({ mode: 'edit', item });
  };

  // Drives whether the hideLevel toggle is offered at all for the skill being edited.
  const editingCertCount = currentModal?.item ? (certCountBySkillId.get(currentModal.item.id) ?? 0) : 0;

  const sorted = [...(skills || [])].sort((a, b) => a.order - b.order);

  const reorderMutation = useMutation({
    mutationFn: async (reordered: Skill[]) => {
      await Promise.all(
        reordered.map((item, index) =>
          item.order === index ? null : apiFetch(`/skills/${item.id}`, { method: 'PATCH', body: JSON.stringify({ ...item, order: index }) })
        )
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminSkills'] }),
  });

  const { dragIndex, overIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useDragReorder(sorted, (reordered) => reorderMutation.mutate(reordered));

  return (
    <div className="space-y-6 text-slate-100">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Skills Manager</h1>
          <p className="text-slate-400 text-sm">Manage the technology grid shown on Home and About.</p>
        </div>
        <button onClick={handleAddClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
          <Plus size={16} /> Add Skill
        </button>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="p-4 w-10"></th>
              <th className="p-4">Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Domains</th>
              <th className="p-4">Level</th>
              <th className="p-4">Certified</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((skill, index) => (
              <tr
                key={skill.id}
                draggable
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`border-b border-slate-800 last:border-0 hover:bg-slate-950/20 cursor-grab active:cursor-grabbing ${dragIndex === index ? 'opacity-40' : ''} ${overIndex === index && dragIndex !== index ? 'border-t-2 border-t-indigo-500' : ''}`}
              >
                <td className="p-4 text-slate-600"><GripVertical size={16} /></td>
                <td className="p-4 font-bold text-white">{skill.name}</td>
                <td className="p-4 text-slate-400">{skill.category}</td>
                <td className="p-4 text-xs text-slate-400">{skill.domains.map((d: ProjectDomain) => PROJECT_DOMAIN_META[d]?.label ?? d).join(', ')}</td>
                <td className="p-4">
                  {skill.hideLevel ? (
                    <span className="text-slate-600 text-xs italic" title="Hidden on the public site">hidden</span>
                  ) : (
                    <div className="h-1.5 w-20 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${(skill.level / 5) * 100}%` }} />
                    </div>
                  )}
                </td>
                <td className="p-4">
                  {certCountBySkillId.get(skill.id) ? (
                    <Link
                      to={`/admin/certifications?skillId=${skill.id}`}
                      aria-label={`View the ${certCountBySkillId.get(skill.id)} certifications validating ${skill.name}`}
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs font-semibold hover:underline"
                    >
                      <BadgeCheck size={13} /> {certCountBySkillId.get(skill.id)}
                    </Link>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleEditClick(skill)} aria-label={`Edit ${skill.name}`} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded"><Edit2 size={14} /></button>
                    <button onClick={() => handleDeleteClick(skill)} aria-label={`Delete ${skill.name}`} className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 rounded"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-slate-500">No skills yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {currentModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button onClick={() => setCurrentModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
            <h3 className="text-xl font-bold text-white mb-6 capitalize">{currentModal.mode} Skill</h3>

            <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
              <div>
                <label htmlFor="skill-name" className="text-slate-400 text-xs font-semibold block mb-2">Name</label>
                <input id="skill-name" type="text" {...register('name')} className="input-field" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
              </div>
              <div>
                <label htmlFor="skill-category" className="text-slate-400 text-xs font-semibold block mb-2">Category</label>
                <input id="skill-category" type="text" {...register('category')} className="input-field" placeholder="Frontend, Backend, ML/AI, Data, Tools..." />
                {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message as string}</p>}
              </div>
              <Controller
                name="domains"
                control={control}
                render={({ field }) => <DomainMultiSelect value={field.value || []} onChange={field.onChange} />}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="skill-level" className="text-slate-400 text-xs font-semibold block mb-2">Level (1-5)</label>
                  <input id="skill-level" type="number" min={1} max={5} {...register('level', { valueAsNumber: true })} className="input-field" />
                </div>
                <div>
                  <label htmlFor="skill-order" className="text-slate-400 text-xs font-semibold block mb-2">Order</label>
                  <input id="skill-order" type="number" {...register('order', { valueAsNumber: true })} className="input-field" />
                </div>
              </div>

              {/* Only offered once the skill has a credential — there's no reason to
                  hide a level that has nothing stronger to defer to. */}
              {editingCertCount > 0 && (
                <div className="border-t border-slate-800 pt-5">
                  <div className="flex items-start gap-2">
                    <input id="skill-hide-level" type="checkbox" {...register('hideLevel')} className="rounded border-slate-800 bg-slate-950 mt-0.5" />
                    <div>
                      <label htmlFor="skill-hide-level" className="text-slate-400 text-xs font-semibold block">Hide the self-rated level publicly</label>
                      <p className="text-[11px] text-slate-500 mt-1">
                        This skill is backed by {editingCertCount} certification{editingCertCount === 1 ? '' : 's'}.
                        Showing &ldquo;Level {'{'}n{'}'}&rdquo; alongside a real credential puts a self-assessment in
                        visual competition with third-party proof.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
