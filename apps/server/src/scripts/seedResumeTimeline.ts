/**
 * Replaces the Experience and Education collections with the real entries from the
 * résumé PDF, which is the source of truth for both.
 *
 *   npm run db:seed-timeline --workspace @portfolio/server
 *
 * Idempotent by design: it clears both collections first, so re-running after a
 * database reset restores exactly this state rather than duplicating rows. That also
 * means **anything added through /admin/experience or /admin/education is wiped** —
 * once the admin becomes the place these are edited, retire this script rather than
 * running it again.
 *
 * `order` ascends from the most recent entry, matching how /about renders the
 * timelines (newest first).
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

// The .env lives at the monorepo root, not beside this script — same two-step load
// the server and the other scripts use (repo root first, then any local override).
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

import { Experience } from '../modules/experience/experience.model';
import { Education } from '../modules/education/education.model';
import { logger } from '../utils/logger';

/** Month is 0-indexed in the Date constructor; these are all first-of-month. */
const at = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1));

const EXPERIENCE = [
  {
    company: 'Kaushalam Digital',
    role: 'Full Stack Developer',
    domains: ['SOFTWARE_DEVELOPMENT', 'DATA_ENGINEERING'] as const,
    startDate: at(2025, 6),
    endDate: at(2026, 3),
    isCurrent: false,
    description:
      'Architected a multi-tenant storefront platform serving 2+ independent storefronts, ' +
      '30,000+ products, 1.4M+ orders and 15,000+ assets via isolated PostgreSQL schemas and ' +
      'Node.js APIs. Built bidirectional sync with Microsoft Business Central ERP, modelled ' +
      '100+ relational tables at 3NF across 3 systems, ran a zero-data-loss migration of 100+ ' +
      'SQL Server tables to PostgreSQL, and raised API load capacity 3× through composite ' +
      'indexing and query optimisation, validated with JMeter before release.',
    order: 0,
  },
  {
    company: 'Kaushalam Digital',
    role: 'PHP Developer Intern',
    domains: ['SOFTWARE_DEVELOPMENT'] as const,
    startDate: at(2025, 1),
    endDate: at(2025, 5),
    isCurrent: false,
    description:
      'Developed 10+ REST APIs with Laravel and Eloquent ORM, implementing RBAC authorisation ' +
      'and relational data models across application modules.',
    order: 1,
  },
  {
    company: 'VThink Solutions',
    role: 'Frontend Developer Intern',
    domains: ['SOFTWARE_DEVELOPMENT'] as const,
    startDate: at(2024, 5),
    endDate: at(2024, 7),
    isCurrent: false,
    description:
      'Streamlined 8+ responsive UI components with Angular and TypeScript, improving ' +
      'cross-device rendering consistency.',
    order: 2,
  },
  {
    company: 'Metanoia Infotech',
    role: 'Full Stack Developer Intern',
    domains: ['SOFTWARE_DEVELOPMENT'] as const,
    startDate: at(2022, 12),
    endDate: at(2023, 2),
    isCurrent: false,
    description:
      'Integrated 5+ PHP REST APIs with interactive frontend components, enabling real-time ' +
      'data rendering across multiple application views.',
    order: 3,
  },
];

const EDUCATION = [
  {
    institution: 'Dhirubhai Ambani University (DAU)',
    degree: 'M.Sc (I.T.)',
    startDate: at(2023, 7),
    endDate: at(2025, 5),
    description: 'CPI 8.2 — Gandhinagar, Gujarat.',
    order: 0,
  },
  {
    institution: 'J.P. Dawer Institute of Information Science and Technology',
    degree: 'B.Sc (I.T.)',
    startDate: at(2020, 10),
    endDate: at(2023, 7),
    description: 'CPI 8.12 — Surat, Gujarat.',
    order: 1,
  },
];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI must be set to seed the résumé timeline.');

  await mongoose.connect(uri);
  try {
    const [removedExp, removedEdu] = await Promise.all([
      Experience.deleteMany({}),
      Education.deleteMany({}),
    ]);

    await Experience.insertMany(EXPERIENCE);
    await Education.insertMany(EDUCATION);

    logger.info(
      {
        experience: { removed: removedExp.deletedCount, inserted: EXPERIENCE.length },
        education: { removed: removedEdu.deletedCount, inserted: EDUCATION.length },
      },
      'Résumé timeline seeded'
    );
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  logger.error({ err }, 'Failed to seed the résumé timeline');
  process.exit(1);
});
