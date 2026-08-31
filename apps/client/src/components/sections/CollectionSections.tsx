import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PROJECT_DOMAIN_META } from '@portfolio/shared';
import type { Project, BlogPost, Skill, Experience, Education, Testimonial, PublicCertification, ProjectDomain } from '@portfolio/types';
import { SkillCertificationBadge } from '../public/SkillCertificationBadge';
import { SectionShell, SectionHeader, SectionCta } from './shared';
import { sectionStyles } from './sectionStyles';
import type { SectionProps } from './types';
import { BadgeCheck, Calendar, ExternalLink, Github, MessageSquare } from 'lucide-react';

function formatMonth(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '';
}

// `items` is already resolved server-side; these components only render it.
export function ProjectListSection(props: SectionProps) {
  const allProjects = props.items as Project[];
  const styles = sectionStyles(props.styleOptions);

  // The `filtered` variant narrows the list the resolver already returned. Filtering in
  // the browser rather than re-querying keeps the one-request-per-page rule intact, and
  // it is what the hand-built /projects page did before it became a CMS page.
  const [domainFilter, setDomainFilter] = useState<ProjectDomain | 'ALL'>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const showFilters = props.layoutVariant === 'filtered';

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allProjects.forEach((p) => (p.techStack ?? []).forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [allProjects]);

  const projects = useMemo(() => {
    if (!showFilters) return allProjects;
    return allProjects.filter(
      (p) =>
        (domainFilter === 'ALL' || (p.domains ?? []).includes(domainFilter)) &&
        (tagFilter === 'ALL' || (p.techStack ?? []).includes(tagFilter))
    );
  }, [allProjects, showFilters, domainFilter, tagFilter]);

  if (allProjects.length === 0) return null;

  const compact = props.layoutVariant === 'compact' || props.layoutVariant === 'list';

  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <SectionHeader heading={props.heading} subheading={props.subheading} />

      {showFilters && (
        <div className="flex flex-wrap gap-4 mb-10">
          <div>
            <label className="sr-only" htmlFor="section-domain-filter">Filter by domain</label>
            <select
              id="section-domain-filter"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value as ProjectDomain | 'ALL')}
              className="form-input w-auto"
            >
              <option value="ALL">All domains</option>
              {(Object.keys(PROJECT_DOMAIN_META) as ProjectDomain[]).map((domain) => (
                <option key={domain} value={domain}>{PROJECT_DOMAIN_META[domain].label}</option>
              ))}
            </select>
          </div>
          {allTags.length > 0 && (
            <div>
              <label className="sr-only" htmlFor="section-tag-filter">Filter by tech tag</label>
              <select
                id="section-tag-filter"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="form-input w-auto"
              >
                <option value="ALL">All technologies</option>
                {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {projects.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400 text-center py-16">No projects match these filters.</p>
      )}

      <div className={compact ? 'space-y-4' : styles.grid}>
        {projects.map((project) => (
          <article
            key={project.id}
            className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden flex flex-col"
          >
            {!compact && project.coverImageUrl && (
              <img src={project.coverImageUrl} alt="" loading="lazy" className="h-44 w-full object-cover" />
            )}
            <div className="p-6 flex flex-col flex-grow">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{project.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex-grow">{project.summary}</p>
              <div className="flex items-center justify-between mt-auto">
                <Link to={`/projects/${project.slug}`} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                  Read case study &rarr;
                </Link>
                <span className="flex gap-3 text-slate-500">
                  {project.repoUrl && (
                    <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" aria-label={`${project.title} repository`}>
                      <Github size={16} />
                    </a>
                  )}
                  {project.liveUrl && (
                    <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" aria-label={`${project.title} live demo`}>
                      <ExternalLink size={16} />
                    </a>
                  )}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
      <SectionCta cta={props.cta} />
    </SectionShell>
  );
}

export function CertificationListSection(props: SectionProps) {
  const certifications = props.items as PublicCertification[];
  const styles = sectionStyles(props.styleOptions);
  if (certifications.length === 0) return null;

  // `grouped` reproduces the /certifications page's domain grouping over the items the
  // resolver already returned.
  if (props.layoutVariant === 'grouped') {
    const groups = (Object.keys(PROJECT_DOMAIN_META) as ProjectDomain[])
      .map((domain) => ({
        domain,
        label: PROJECT_DOMAIN_META[domain].label,
        items: certifications.filter((cert) => (cert.domains ?? []).includes(domain)),
      }))
      // A domain with nothing in it reads as a gap in the record rather than an
      // irrelevant category, so it is omitted entirely.
      .filter((group) => group.items.length > 0);

    const ungrouped = certifications.filter((cert) => (cert.domains ?? []).length === 0);

    return (
      <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
        <SectionHeader heading={props.heading} subheading={props.subheading} />
        <div className="space-y-12">
          {groups.map((group) => (
            <div key={group.domain}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-6">
                {group.label}
              </h3>
              <div className={styles.grid}>
                {group.items.map((cert) => <CertificationCard key={cert.id} cert={cert} />)}
              </div>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-6">Other</h3>
              <div className={styles.grid}>
                {ungrouped.map((cert) => <CertificationCard key={cert.id} cert={cert} />)}
              </div>
            </div>
          )}
        </div>
        <SectionCta cta={props.cta} />
      </SectionShell>
    );
  }

  if (props.layoutVariant === 'logos') {
    return (
      <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
        <SectionHeader heading={props.heading} subheading={props.subheading} />
        <ul className="flex flex-wrap items-center gap-3">
          {certifications.map((cert) => (
            <li key={cert.id}>
              <Link
                to={`/certifications#cert-${cert.id}`}
                aria-label={`${cert.name} — ${cert.issuingOrganization}`}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"
              >
                {cert.issuerLogoUrl ? (
                  <img src={cert.issuerLogoUrl} alt="" loading="lazy" className="w-7 h-7 object-contain bg-white rounded p-0.5" />
                ) : (
                  <BadgeCheck size={16} className="text-indigo-500" aria-hidden="true" />
                )}
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{cert.issuingOrganization}</span>
              </Link>
            </li>
          ))}
        </ul>
      </SectionShell>
    );
  }

  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <SectionHeader heading={props.heading} subheading={props.subheading} />
      <div className={props.layoutVariant === 'list' ? 'space-y-4' : styles.grid}>
        {certifications.map((cert) => <CertificationCard key={cert.id} cert={cert} />)}
      </div>
      <SectionCta cta={props.cta} />
    </SectionShell>
  );
}

/** Shared by the flat and grouped certification variants so they cannot drift apart. */
function CertificationCard({ cert }: { cert: PublicCertification }) {
  return (
    <article id={`cert-${cert.id}`} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6">
      <h3 className="font-bold text-slate-900 dark:text-white">{cert.name}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">{cert.issuingOrganization}</p>
      <p className="text-xs text-slate-500 mt-2">
        Issued {formatMonth(cert.issueDate)}
        {/* Expired reads neutral, never alarming — a lapsed cert is still evidence. */}
        {cert.isExpired && <span className="ml-2 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">Expired</span>}
      </p>
      {cert.credentialUrl && (
        <a href={cert.credentialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-3">
          Verify <ExternalLink size={11} aria-hidden="true" />
        </a>
      )}
    </article>
  );
}

export function SkillListSection(props: SectionProps) {
  const skills = props.items as Skill[];
  const styles = sectionStyles(props.styleOptions);
  if (skills.length === 0) return null;

  if (props.layoutVariant === 'chips') {
    return (
      <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
        <SectionHeader heading={props.heading} subheading={props.subheading} />
        <ul className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li key={skill.id} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm px-3 py-1.5 rounded-lg">
              {skill.name}
              <SkillCertificationBadge skillName={skill.name} certifications={skill.certifications ?? []} />
            </li>
          ))}
        </ul>
      </SectionShell>
    );
  }

  const grouped = skills.reduce((acc: Record<string, Skill[]>, skill) => {
    (acc[skill.category] ??= []).push(skill);
    return acc;
  }, {});

  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <SectionHeader heading={props.heading} subheading={props.subheading} />
      <div className={styles.grid}>
        {Object.entries(grouped).map(([category, list]) => (
          <div key={category} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-6 rounded-xl">
            <h3 className="text-sm font-bold mb-4 text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">{category}</h3>
            <div className="space-y-4">
              {list.map((skill) => (
                <div key={skill.id} id={`skill-${skill.id}`} className="scroll-mt-28">
                  <div className="flex justify-between items-center gap-2 text-sm mb-1.5 font-medium">
                    <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{skill.name}</span>
                      <SkillCertificationBadge skillName={skill.name} certifications={skill.certifications ?? []} />
                    </span>
                    {!skill.hideLevel && <span className="text-slate-500 text-xs shrink-0">{skill.level}/5</span>}
                  </div>
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
    </SectionShell>
  );
}

function Timeline({ entries }: { entries: { id: string; title: string; subtitle: string; start?: string; end?: string; current?: boolean; description?: string }[] }) {
  return (
    <ol className="border-l border-slate-200 dark:border-slate-800 pl-6 ml-3 space-y-10">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-500 bg-white dark:bg-slate-950" />
          <span className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold flex items-center gap-1.5 mb-2">
            <Calendar size={12} aria-hidden="true" /> {formatMonth(entry.start)} &mdash; {entry.current ? 'Present' : formatMonth(entry.end) || 'N/A'}
          </span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{entry.title}</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{entry.subtitle}</p>
          {entry.description && <p className="text-slate-600 dark:text-slate-300 text-sm mt-2 leading-relaxed">{entry.description}</p>}
        </li>
      ))}
    </ol>
  );
}

export function ExperienceTimelineSection(props: SectionProps) {
  const experiences = props.items as Experience[];
  if (experiences.length === 0) return null;
  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <SectionHeader heading={props.heading} subheading={props.subheading} />
      <Timeline
        entries={experiences.map((e) => ({
          id: e.id, title: e.role, subtitle: e.company,
          start: e.startDate, end: e.endDate, current: e.isCurrent, description: e.description,
        }))}
      />
    </SectionShell>
  );
}

export function EducationTimelineSection(props: SectionProps) {
  const educations = props.items as Education[];
  if (educations.length === 0) return null;
  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <SectionHeader heading={props.heading} subheading={props.subheading} />
      <Timeline
        entries={educations.map((e) => ({
          id: e.id, title: e.degree, subtitle: e.institution,
          start: e.startDate, end: e.endDate, description: e.description,
        }))}
      />
    </SectionShell>
  );
}

export function TestimonialListSection(props: SectionProps) {
  const testimonials = props.items as Testimonial[];
  const styles = sectionStyles(props.styleOptions);
  if (testimonials.length === 0) return null;

  const shown = props.layoutVariant === 'single' ? testimonials.slice(0, 1) : testimonials;

  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <SectionHeader heading={props.heading} subheading={props.subheading} />
      <div className={props.layoutVariant === 'single' ? '' : styles.grid}>
        {shown.map((t) => (
          <figure key={t.id} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-6 rounded-xl flex flex-col">
            <MessageSquare size={20} className="text-indigo-500 mb-4" aria-hidden="true" />
            <blockquote className="text-slate-600 dark:text-slate-300 italic flex-grow">&quot;{t.quote}&quot;</blockquote>
            <figcaption className="flex items-center gap-3 mt-5">
              {t.avatarUrl && <img src={t.avatarUrl} alt="" loading="lazy" className="w-10 h-10 rounded-full object-cover" />}
              <span>
                <span className="block font-bold text-sm text-slate-900 dark:text-white">{t.name}</span>
                <span className="block text-xs text-slate-500">{t.role}{t.company ? ` at ${t.company}` : ''}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}

export function BlogListSection(props: SectionProps) {
  const posts = props.items as BlogPost[];
  const styles = sectionStyles(props.styleOptions);
  if (posts.length === 0) return null;

  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <SectionHeader heading={props.heading} subheading={props.subheading} />
      <div className={props.layoutVariant === 'list' ? 'space-y-4' : styles.grid}>
        {posts.map((post) => (
          <article key={post.id} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden">
            <Link to={`/blog/${post.slug}`} className="block p-6">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 block mb-2">{formatMonth(post.publishedAt)}</span>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">{post.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3">{post.excerpt}</p>
            </Link>
          </article>
        ))}
      </div>
      <SectionCta cta={props.cta} />
    </SectionShell>
  );
}

interface ChildPage {
  path: string;
  title: string;
  navLabel?: string;
  metaDescription?: string;
}

export function ChildPageListSection(props: SectionProps) {
  const children = props.items as ChildPage[];
  const styles = sectionStyles(props.styleOptions);
  // Renders nothing at all when there are no published children — an empty container
  // would read as a broken section rather than an absent one.
  if (children.length === 0) return null;

  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <SectionHeader heading={props.heading} subheading={props.subheading} />
      <div className={props.layoutVariant === 'list' ? 'space-y-2' : styles.grid}>
        {children.map((child) => (
          <Link
            key={child.path}
            to={child.path}
            className="block bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 hover:border-indigo-400 rounded-xl p-5 transition-colors"
          >
            <span className="block font-bold text-slate-900 dark:text-white">{child.navLabel || child.title}</span>
            {child.metaDescription && (
              <span className="block text-sm text-slate-500 dark:text-slate-400 mt-1">{child.metaDescription}</span>
            )}
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}
