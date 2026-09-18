/**
 * Reports (and optionally applies) drift between the indexes declared in the schemas and
 * the indexes a database actually has.
 *
 * Mongoose only ever *creates* missing indexes on boot. It never alters an existing one
 * whose options changed, and never drops one whose declaration was removed. So a database
 * that has been through a few schema revisions quietly diverges from the code — and the
 * test suite cannot catch it, because mongodb-memory-server starts empty every run and
 * therefore always builds exactly what is declared.
 *
 * The failure this was written for: `path` was originally a plain unique index and later
 * became partial on `deletedAt`, so that a soft-deleted page frees its URL. On a database
 * still carrying the old index, recreating a page at a deleted page's URL fails.
 *
 *   npm run db:indexes           # report only, changes nothing
 *   npm run db:indexes -- --apply
 *
 * Dry-run is the default deliberately: syncIndexes() DROPS indexes that are no longer
 * declared, and an index build on a large collection can block writes. This is a
 * maintenance command an operator runs knowingly, not something that happens at boot.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose, { Model } from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { Page } from '../modules/pages/page.model';
import { Project } from '../modules/projects/project.model';
import { BlogPost } from '../modules/blog/blogPost.model';
import { Skill } from '../modules/skills/skill.model';
import { Certification } from '../modules/certifications/certification.model';
import { Experience } from '../modules/experience/experience.model';
import { Education } from '../modules/education/education.model';
import { Testimonial } from '../modules/testimonials/testimonial.model';
import { Resume } from '../modules/resume/resume.model';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODELS: Model<any>[] = [
  Page, Project, BlogPost, Skill, Certification, Experience, Education, Testimonial, Resume,
];

interface IndexInfo {
  key: Record<string, unknown>;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}

function describe(index: IndexInfo): string {
  const flags = [
    index.unique ? 'unique' : null,
    index.partialFilterExpression ? `partial ${JSON.stringify(index.partialFilterExpression)}` : null,
  ].filter(Boolean);
  return `${JSON.stringify(index.key)}${flags.length ? ` [${flags.join(', ')}]` : ''}`;
}

async function main() {
  const apply = process.argv.includes('--apply');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}\n`);

  let drift = 0;

  for (const model of MODELS) {
    // What the schema says, versus what the database has.
    const declared = model.schema
      .indexes()
      .map(([key, options]: [Record<string, unknown>, Record<string, unknown> | undefined]) => ({
        key,
        ...(options ?? {}),
      })) as IndexInfo[];
    const actual = (await model.collection.indexes()) as unknown as IndexInfo[];

    const signature = (index: IndexInfo) => describe(index);
    const declaredSigs = new Set(declared.map(signature));
    // _id_ is implicit and never declared, so it is not drift.
    const actualReal = actual.filter((index) => JSON.stringify(index.key) !== '{"_id":1}');
    const actualSigs = new Set(actualReal.map(signature));

    const missing = declared.filter((index) => !actualSigs.has(signature(index)));
    const extra = actualReal.filter((index) => !declaredSigs.has(signature(index)));

    if (missing.length === 0 && extra.length === 0) {
      console.log(`✓ ${model.modelName} — in sync (${actualReal.length} indexes)`);
      continue;
    }

    drift++;
    console.log(`✗ ${model.modelName}`);
    for (const index of missing) console.log(`    MISSING (declared, not built) : ${describe(index)}`);
    for (const index of extra) console.log(`    EXTRA   (built, not declared) : ${describe(index)}`);
  }

  console.log('');

  if (drift === 0) {
    console.log('No drift. Nothing to do.');
  } else if (!apply) {
    console.log(`${drift} collection(s) have index drift.`);
    console.log('This is a REPORT ONLY. Re-run with --apply to drop the extras and build');
    console.log('the missing ones. Do that during a quiet window: dropping and rebuilding');
    console.log('an index can block writes on a large collection.');
  } else {
    console.log('Applying...\n');
    for (const model of MODELS) {
      const dropped = await model.syncIndexes();
      console.log(`  ${model.modelName}: dropped ${dropped.length ? dropped.join(', ') : 'nothing'}`);
    }
    console.log('\nDone. Re-run without --apply to confirm.');
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
