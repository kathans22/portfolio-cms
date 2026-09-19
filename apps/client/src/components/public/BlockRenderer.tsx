import React from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { Info, AlertTriangle, TrendingUp } from 'lucide-react';
import { extractDriveFileId, drivePreviewUrl, normalizeImageUrl } from '@portfolio/shared';
import type { ContentBlock } from '@portfolio/shared';
import { renderMarkdown } from '../../lib/renderMarkdown';

function isEmbeddableVideo(url: string) {
  return /youtube\.com|youtu\.be|vimeo\.com/.test(url) || extractDriveFileId(url) !== null;
}

function toEmbedUrl(url: string) {
  // A Drive video plays in Drive's own embeddable preview player.
  const driveId = extractDriveFileId(url);
  if (driveId) return drivePreviewUrl(driveId);
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
}

const CALLOUT_STYLES = {
  info: {
    icon: Info,
    classes: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300',
  },
  metric: {
    icon: TrendingUp,
    classes: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  },
} as const;

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <div
          className="prose-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(block.markdown) }}
        />
      );

    case 'image':
      return (
        <figure className="my-6">
          <img
            src={normalizeImageUrl(block.url)}
            referrerPolicy="no-referrer"
            alt={block.altText || block.caption || ''}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800"
          />
          {block.caption && (
            <figcaption className="text-center text-xs text-slate-500 dark:text-slate-500 mt-2">{block.caption}</figcaption>
          )}
        </figure>
      );

    case 'diagram':
      return (
        <figure className="my-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <img src={normalizeImageUrl(block.url)} referrerPolicy="no-referrer" alt={block.caption || 'Diagram'} className="w-full rounded-lg" />
          {block.caption && (
            <figcaption className="text-center text-xs text-slate-500 dark:text-slate-500 mt-2">{block.caption}</figcaption>
          )}
        </figure>
      );

    case 'video':
      return (
        <figure className="my-6">
          {isEmbeddableVideo(block.url) ? (
            <div className="aspect-video">
              <iframe
                src={toEmbedUrl(block.url)}
                title={block.caption || 'Embedded video'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800"
              />
            </div>
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={block.url} controls className="w-full rounded-xl border border-slate-200 dark:border-slate-800" />
          )}
          {block.caption && (
            <figcaption className="text-center text-xs text-slate-500 dark:text-slate-500 mt-2">{block.caption}</figcaption>
          )}
        </figure>
      );

    case 'code':
      return (
        <Highlight code={block.code.trim()} language={block.language || 'text'} theme={themes.vsDark}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre className={`${className} my-6 p-4 rounded-xl overflow-x-auto text-xs leading-relaxed`} style={style}>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      );

    case 'callout': {
      const style = CALLOUT_STYLES[block.variant];
      const Icon = style.icon;
      return (
        <div role="note" className={`my-6 p-4 rounded-xl border flex gap-3 ${style.classes}`}>
          <Icon size={18} className="shrink-0 mt-0.5" />
          <div>
            {block.title && <p className="font-semibold text-sm mb-1">{block.title}</p>}
            <p className="text-sm leading-relaxed">{block.body}</p>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

export function BlockRenderer({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}
