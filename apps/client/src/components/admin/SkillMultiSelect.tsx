import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Skill } from '@portfolio/types';
import { apiFetch } from '../../lib/api';
import { AlertTriangle, Search, Plus, X } from 'lucide-react';

// Above this, one credential is claiming a lot of ground. Warned about, never blocked —
// a broad credential legitimately covers many skills.
const MANY_SKILLS_THRESHOLD = 6;

interface SkillMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
}

// Picks real Skill documents by id. Deliberately not a free-text field: "Node.js",
// "NodeJS" and "Node" are three different strings that match zero Skill documents,
// which would leave every skill-to-credential lookup silently empty.
export function SkillMultiSelect({ value, onChange, label = 'Skills this credential validates' }: SkillMultiSelectProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', category: '' });
  const [createError, setCreateError] = useState('');

  const { data: skills, isLoading } = useQuery<Skill[]>({
    queryKey: ['adminSkillsPicker'],
    queryFn: async () => (await apiFetch('/skills')).json(),
  });

  const matching = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return skills ?? [];
    return (skills ?? []).filter(
      (skill) => skill.name.toLowerCase().includes(term) || skill.category.toLowerCase().includes(term)
    );
  }, [skills, search]);

  // Creating a skill without leaving the certification form removes the main reason
  // someone would otherwise resort to typing a free-text skill name.
  const createSkill = useMutation<Skill, Error, { name: string; category: string }>({
    mutationFn: async (payload) => {
      const res = await apiFetch('/skills', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to create skill');
      }
      return res.json();
    },
    onSuccess: (skill) => {
      queryClient.invalidateQueries({ queryKey: ['adminSkillsPicker'] });
      queryClient.invalidateQueries({ queryKey: ['adminSkills'] });
      onChange([...value, skill.id]);
      setCreating(false);
      setDraft({ name: '', category: '' });
      setCreateError('');
    },
    onError: (err) => setCreateError(err.message),
  });

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((s) => s !== id) : [...value, id]);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-slate-400 text-xs font-semibold">{label}</span>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
        >
          <Plus size={12} /> Create new skill
        </button>
      </div>

      <p className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 mb-3">
        <AlertTriangle size={13} className="shrink-0 mt-px text-slate-500" />
        <span>Map only skills this credential genuinely validates.</span>
      </p>

      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by skill or category..."
          className="input-field pl-9"
          aria-label="Search skills"
        />
      </div>

      {isLoading && <p className="text-xs text-slate-500">Loading skills…</p>}

      {!isLoading && matching.length === 0 && (
        <p className="text-xs text-slate-500">
          {search ? 'No skills match that search.' : 'No skills exist yet — create one above.'}
        </p>
      )}

      <div className="max-h-56 overflow-y-auto grid sm:grid-cols-2 gap-2 pr-1">
        {matching.map((skill) => (
          <label
            key={skill.id}
            className={`flex items-start gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${
              value.includes(skill.id)
                ? 'bg-indigo-500/10 border-indigo-500/40'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <input
              type="checkbox"
              checked={value.includes(skill.id)}
              onChange={() => toggle(skill.id)}
              className="rounded border-slate-800 bg-slate-950 mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-xs text-slate-200 truncate">{skill.name}</span>
              {/* Category disambiguates similarly-named skills across areas. */}
              <span className="block text-[10px] text-slate-500 truncate">{skill.category}</span>
            </span>
          </label>
        ))}
      </div>

      {/* §5.3 — non-blocking on purpose. A moment of deliberation, not a rule to resent. */}
      {value.length > MANY_SKILLS_THRESHOLD && (
        <p
          role="status"
          className="flex items-start gap-2 text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/25 rounded-lg px-3 py-2 mt-3"
        >
          <AlertTriangle size={13} className="shrink-0 mt-px" />
          <span>
            Mapping many skills to one credential can weaken its signal. Map only skills this
            certification genuinely validates.
          </span>
        </p>
      )}

      <p className="text-[11px] text-slate-500 mt-2">
        {value.length === 0
          ? 'No skills mapped — this is fine and common.'
          : `${value.length} skill${value.length === 1 ? '' : 's'} mapped.`}
      </p>

      {creating && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-6 relative">
            <button
              type="button"
              onClick={() => { setCreating(false); setCreateError(''); }}
              aria-label="Cancel creating skill"
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            <h4 className="text-lg font-bold text-white mb-4">New skill</h4>

            <div className="space-y-4">
              <div>
                <label htmlFor="new-skill-name" className="text-slate-400 text-xs font-semibold block mb-2">Name</label>
                <input
                  id="new-skill-name"
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="input-field"
                  placeholder="Kubernetes"
                />
              </div>
              <div>
                <label htmlFor="new-skill-category" className="text-slate-400 text-xs font-semibold block mb-2">Category</label>
                <input
                  id="new-skill-category"
                  type="text"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="input-field"
                  placeholder="Tools"
                />
              </div>

              {createError && <p className="text-red-500 text-xs">{createError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setCreating(false); setCreateError(''); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                {/* type="button" throughout: this modal lives inside the certification
                    form, and a submit here would save the certification instead. */}
                <button
                  type="button"
                  disabled={!draft.name.trim() || !draft.category.trim() || createSkill.isPending}
                  onClick={() => createSkill.mutate({ name: draft.name.trim(), category: draft.category.trim() })}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm disabled:opacity-50"
                >
                  {createSkill.isPending ? 'Creating…' : 'Create & select'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
