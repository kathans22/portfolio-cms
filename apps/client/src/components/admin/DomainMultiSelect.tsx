import React from 'react';
import { PROJECT_DOMAIN_META, ProjectDomain } from '@portfolio/shared';

const DOMAIN_OPTIONS = Object.entries(PROJECT_DOMAIN_META) as [ProjectDomain, { label: string; slug: string }][];

interface DomainMultiSelectProps {
  value: ProjectDomain[];
  onChange: (next: ProjectDomain[]) => void;
  label?: string;
}

export function DomainMultiSelect({ value, onChange, label = 'Domains' }: DomainMultiSelectProps) {
  const toggle = (domain: ProjectDomain) => {
    onChange(value.includes(domain) ? value.filter((d) => d !== domain) : [...value, domain]);
  };

  return (
    <div>
      <span className="text-slate-400 text-xs font-semibold block mb-2">{label}</span>
      <div className="flex flex-wrap gap-3">
        {DOMAIN_OPTIONS.map(([domainValue, meta]) => (
          <label key={domainValue} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.includes(domainValue)}
              onChange={() => toggle(domainValue)}
              className="rounded border-slate-800 bg-slate-950"
            />
            <span className="text-xs text-slate-300">{meta.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
