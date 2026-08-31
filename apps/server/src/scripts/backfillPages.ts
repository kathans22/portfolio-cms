/**
 * Build-order step 11: backfill the site's existing hardcoded pages as Page documents,
 * so their content becomes admin-editable without a deploy.
 *
 *   npm run db:backfill-pages           # report what it would create, changes nothing
 *   npm run db:backfill-pages -- --apply
 *
 * Idempotent: a page whose path already exists is left completely alone, including its
 * sections. Re-running never overwrites edits an admin has since made — that would make
 * this script a content-destroying footgun the first time someone ran it twice.
 *
 * Dev/first-deploy only. It refuses to run when NODE_ENV=production unless --force is
 * passed, matching seed.ts: bulk content writes must never be a surprise in production.
 *
 * These six are created with `isSystem: true`. They back routes the app links to by
 * name, so the delete guard should refuse to remove them; slug and parent are locked in
 * the editor for the same reason. Sections, content, SEO and ordering all stay editable.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { Page, PageAttrs, SectionAttrs, StyleOptions, SectionQuery } from '../modules/pages/page.model';
import { LIVE } from '../modules/pages/page.service';

type SectionSeed = Partial<SectionAttrs> & { type: string };

interface PageSeed {
  slug: string;
  path: string;
  title: string;
  navLabel?: string;
  navOrder: number;
  showInNav: boolean;
  metaTitle: string;
  metaDescription: string;
  sections: SectionSeed[];
}

// Typed returns, not Record<string, unknown>: the enums here are literal unions, and an
// untyped helper widens them to `string`, so a typo in a seed would only surface as a
// Mongoose validation error at write time.
const style = (over: Partial<StyleOptions> = {}): StyleOptions => ({
  background: 'none', paddingY: 'lg', maxWidth: 'default',
  columns: 3, alignment: 'left', dividerAbove: false, ...over,
});

const query = (over: Partial<SectionQuery> = {}): SectionQuery => ({
  domains: [], tags: [], skillIds: [], featuredOnly: false,
  limit: 0, sortBy: 'order', sortDir: 'asc', includeExpired: false, ...over,
});

/**
 * Mirrors what each hand-built page renders today. Where the bespoke page had
 * interactive controls, the matching variant reproduces them (`filtered`, `grouped`)
 * rather than quietly dropping them.
 */
const SEEDS: PageSeed[] = [
  {
    slug: 'home',
    path: '/',
    title: 'Home',
    navLabel: 'Home',
    navOrder: 0,
    showInNav: true,
    metaTitle: 'Kathan — Software, AI & Data Engineering',
    metaDescription: 'Portfolio of Kathan: production systems across software, AI and data engineering.',
    sections: [
      {
        type: 'HERO', heading: 'Building production systems across software, AI and data',
        subheading: 'I design and ship systems that hold up under real traffic, real data and real deadlines.',
        layoutVariant: 'default', order: 0, styleOptions: style({ paddingY: 'xl', alignment: 'center' }),
        cta: { label: 'See selected work', href: '/projects', variant: 'primary' },
      },
      {
        type: 'PROJECT_LIST', heading: 'Selected Work',
        subheading: 'A few systems worth talking about.',
        layoutVariant: 'grid', order: 1, styleOptions: style(),
        query: query({ featuredOnly: true, limit: 3 }),
        cta: { label: 'All case studies', href: '/projects', variant: 'secondary' },
      },
      {
        type: 'SKILL_LIST', heading: 'Core Technology',
        layoutVariant: 'grouped', order: 2, styleOptions: style({ background: 'subtle' }),
        query: query(),
      },
      {
        type: 'BLOG_LIST', heading: 'Latest Insights',
        layoutVariant: 'grid', order: 3, styleOptions: style(),
        query: query({ limit: 3, sortBy: 'publishedAt', sortDir: 'desc' }),
        cta: { label: 'Read the blog', href: '/blog', variant: 'ghost' },
      },
      {
        type: 'TESTIMONIAL_LIST', heading: 'Testimonials',
        layoutVariant: 'grid', order: 4, styleOptions: style({ background: 'subtle' }),
        query: query(),
      },
      {
        type: 'CONTACT_FORM', heading: "Let's Connect",
        subheading: 'Tell me about the problem you are trying to solve.',
        layoutVariant: 'split', order: 5, styleOptions: style(),
      },
    ],
  },
  {
    slug: 'projects',
    path: '/projects',
    title: 'Case Studies',
    navLabel: 'Work',
    navOrder: 1,
    showInNav: true,
    metaTitle: 'Case Studies — Kathan',
    metaDescription: 'Selected engineering case studies across software, AI and data.',
    sections: [
      {
        type: 'PROJECT_LIST', heading: 'Case Studies',
        subheading: 'Filter by domain or technology.',
        // `filtered` keeps the domain and tech-stack controls the hand-built page had.
        layoutVariant: 'filtered', order: 0, styleOptions: style({ paddingY: 'xl' }),
        query: query(),
      },
    ],
  },
  {
    slug: 'about',
    path: '/about',
    title: 'About Me',
    navLabel: 'About',
    navOrder: 2,
    showInNav: true,
    metaTitle: 'About — Kathan',
    metaDescription: 'Background, work history, education and the principles behind how I build.',
    sections: [
      {
        type: 'RICH_CONTENT', heading: 'About Me',
        layoutVariant: 'prose', order: 0, styleOptions: style({ paddingY: 'xl', maxWidth: 'narrow' }),
        contentBlocks: [
          {
            type: 'paragraph',
            markdown:
              'I build systems that survive contact with production. Most of my work sits where ' +
              'software engineering, applied AI and data infrastructure meet.',
          },
          {
            type: 'paragraph',
            markdown:
              '**Principles I follow**\n\n' +
              '- Correctness before cleverness — a system that is wrong quickly is still wrong.\n' +
              '- Make the failure mode visible; silent degradation costs more than an outage.\n' +
              '- Evidence over assertion: if a claim matters, it should be checkable.',
          },
        ],
      },
      {
        type: 'EXPERIENCE_TIMELINE', heading: 'Work History', anchorId: 'experience',
        layoutVariant: 'timeline', order: 1, styleOptions: style({ maxWidth: 'narrow' }),
        query: query({ sortBy: 'startDate', sortDir: 'desc' }),
      },
      {
        type: 'EDUCATION_TIMELINE', heading: 'Education', anchorId: 'education',
        layoutVariant: 'timeline', order: 2, styleOptions: style({ maxWidth: 'narrow' }),
        query: query({ sortBy: 'startDate', sortDir: 'desc' }),
      },
      {
        type: 'SKILL_LIST', heading: 'Skills', anchorId: 'skills',
        layoutVariant: 'grouped', order: 3, styleOptions: style({ background: 'subtle' }),
        query: query(),
      },
    ],
  },
  {
    slug: 'certifications',
    path: '/certifications',
    title: 'Certifications',
    navLabel: 'Certifications',
    navOrder: 3,
    showInNav: true,
    metaTitle: 'Certifications — Kathan',
    metaDescription: 'Verified certifications, grouped by engineering domain.',
    sections: [
      {
        type: 'CERTIFICATION_LIST', heading: 'Certifications',
        subheading: 'Credentials I hold, with verification links.',
        // `grouped` reproduces the hand-built page's grouping by domain.
        layoutVariant: 'grouped', order: 0, styleOptions: style({ paddingY: 'xl' }),
        query: query(),
      },
    ],
  },
  {
    slug: 'blog',
    path: '/blog',
    title: 'Blog',
    navLabel: 'Blog',
    navOrder: 4,
    showInNav: true,
    metaTitle: 'Blog — Kathan',
    metaDescription: 'Notes on building and shipping production systems.',
    sections: [
      {
        type: 'BLOG_LIST', heading: 'Writing',
        subheading: 'Notes on building and shipping production systems.',
        layoutVariant: 'grid', order: 0, styleOptions: style({ paddingY: 'xl' }),
        query: query({ sortBy: 'publishedAt', sortDir: 'desc' }),
      },
    ],
  },
  {
    slug: 'contact',
    path: '/contact',
    title: "Let's Connect",
    navLabel: 'Contact',
    navOrder: 5,
    showInNav: true,
    metaTitle: 'Contact — Kathan',
    metaDescription: 'Get in touch about engineering work, collaboration or hiring.',
    sections: [
      {
        type: 'CONTACT_FORM', heading: "Let's Connect",
        subheading: 'Tell me what you are working on and I will reply personally.',
        layoutVariant: 'default', order: 0, styleOptions: style({ paddingY: 'xl', maxWidth: 'narrow' }),
      },
    ],
  },
];

async function main() {
  const apply = process.argv.includes('--apply');
  const force = process.argv.includes('--force');

  if (process.env.NODE_ENV === 'production' && !force) {
    console.error('Refusing to run against NODE_ENV=production without --force.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}\n`);

  const toCreate: PageSeed[] = [];
  for (const seed of SEEDS) {
    const existing = await Page.findOne({ path: seed.path, ...LIVE });
    if (existing) {
      console.log(`  skip    ${seed.path.padEnd(18)} already exists (${existing.sections?.length ?? 0} sections) — left untouched`);
    } else {
      console.log(`  create  ${seed.path.padEnd(18)} ${seed.sections.length} sections: ${seed.sections.map((s) => s.type).join(', ')}`);
      toCreate.push(seed);
    }
  }

  console.log('');

  if (toCreate.length === 0) {
    console.log('Nothing to create.');
  } else if (!apply) {
    console.log(`${toCreate.length} page(s) would be created. This is a REPORT ONLY — re-run with --apply.`);
  } else {
    for (const seed of toCreate) {
      await Page.create({
        slug: seed.slug,
        path: seed.path,
        parentId: null,
        depth: 0,
        previousPaths: [],
        title: seed.title,
        navLabel: seed.navLabel,
        sections: seed.sections,
        showInNav: seed.showInNav,
        navOrder: seed.navOrder,
        status: 'PUBLISHED',
        isSystem: true,
        metaTitle: seed.metaTitle,
        metaDescription: seed.metaDescription,
        noIndex: false,
        lastPublishedAt: new Date(),
      } as unknown as PageAttrs);
      console.log(`  created ${seed.path}`);
    }
    console.log(`\nCreated ${toCreate.length} page(s).`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
