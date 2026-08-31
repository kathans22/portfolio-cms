import React from 'react';
import { SectionShell, SectionHeader, SectionCta } from './shared';
import type { SectionProps } from './types';
import { FileDown } from 'lucide-react';

/**
 * The contact form is a self-contained widget rather than a collection, so it holds its
 * own form state — but still fetches nothing on mount. Submitting is a user-initiated
 * action, not a data-loading waterfall.
 */
export function ContactFormSection(props: SectionProps) {
  const split = props.layoutVariant === 'split';
  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <div className={split ? 'grid md:grid-cols-2 gap-12 items-start' : ''}>
        <div>
          <SectionHeader heading={props.heading} subheading={props.subheading} />
        </div>
        <ContactFormBody />
      </div>
    </SectionShell>
  );
}

// Kept minimal and uncontrolled: the fully validated form lives on /contact. This
// variant exists so a CMS page can offer a contact point without duplicating that page.
function ContactFormBody() {
  return (
    <form
      action="/contact"
      method="get"
      className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-6 rounded-xl space-y-4"
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Prefer the full form? It has everything, including a subject line.
      </p>
      <button
        type="submit"
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-white transition-colors"
      >
        Go to contact form
      </button>
    </form>
  );
}

export function ResumeDownloadSection(props: SectionProps) {
  // The other thing recruiters look for first — one click from anywhere.
  const inline = props.layoutVariant === 'inline';
  const href = props.cta?.href || '/resume.pdf';

  return (
    <SectionShell anchorId={props.anchorId} styleOptions={props.styleOptions}>
      <div
        className={`flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 ${
          inline ? 'px-4 py-3' : 'px-6 py-6'
        }`}
      >
        <FileDown className="text-indigo-500 shrink-0" size={inline ? 18 : 24} aria-hidden="true" />
        <div className="min-w-0 flex-grow">
          {props.heading && <p className="font-bold text-slate-900 dark:text-white">{props.heading}</p>}
          {props.subheading && <p className="text-sm text-slate-500 dark:text-slate-400">{props.subheading}</p>}
        </div>
        {props.cta?.label ? (
          <SectionCta cta={props.cta} />
        ) : (
          <a
            href={href}
            download
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Download CV
          </a>
        )}
      </div>
    </SectionShell>
  );
}
