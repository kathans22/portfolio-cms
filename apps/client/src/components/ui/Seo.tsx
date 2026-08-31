import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'Kathan — Portfolio';
const DEFAULT_DESCRIPTION = 'Full-stack engineer and solutions architect building production-grade web, AI, and data platforms.';
const DEFAULT_OG_IMAGE = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80';
const SITE_URL = typeof window !== 'undefined' ? window.location.origin : '';

interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  path?: string;
  type?: 'website' | 'article';
  noIndex?: boolean;
  /** Emit the Person schema. Home page only — it describes the site's subject, not each page. */
  personSchema?: boolean;
}

const PERSON_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Kathan',
  jobTitle: 'Full-Stack Developer & Solutions Architect',
  description: DEFAULT_DESCRIPTION,
  knowsAbout: ['Software Development', 'AI Engineering', 'Data Engineering'],
};

export function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_OG_IMAGE,
  path = '',
  type = 'website',
  noIndex = false,
  personSchema = false,
}: SeoProps) {
  const fullTitle = title === SITE_NAME ? title : `${title} · ${SITE_NAME}`;
  const url = `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {/* Canonical matters more now that previousPaths lets several URLs reach the
          same content — without it those redirects read as duplicate pages. */}
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex" />}

      {personSchema && (
        <script type="application/ld+json">
          {JSON.stringify({ ...PERSON_JSON_LD, url: SITE_URL || undefined })}
        </script>
      )}

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
