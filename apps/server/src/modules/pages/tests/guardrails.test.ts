import { describe, it, expect } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { Project } from '../../projects/project.model';
import { Page, PageAttrs, MAX_PREVIOUS_PATHS, SOFT_DELETE_RETENTION_DAYS } from '../page.model';
import { purgeExpiredDeletedPages } from '../cleanup';

async function login() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await Admin.create({ email: 'admin@portfolio.test', passwordHash, name: 'Admin' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@portfolio.test', password: 'admin123' });
  return res.body.access_token as string;
}

type Overrides = Record<string, unknown>;

function seedPage(overrides: Overrides = {}) {
  return Page.create({
    slug: 'guides',
    path: '/guides',
    title: 'Guides',
    status: 'PUBLISHED',
    ...overrides,
  } as unknown as PageAttrs);
}

function seedProject(overrides: Overrides = {}) {
  return Project.create({
    title: 'Payout System',
    slug: 'payout-system',
    summary: 'A payments platform.',
    description: 'A payments platform with reconciliation and ledgers.',
    status: 'PUBLISHED',
    ...overrides,
  } as never);
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const createPage = (token: string, body: Overrides) =>
  request(app).post('/api/v1/admin/pages').set(auth(token)).send(body);

describe('§4.1 slug validation', () => {
  it('rejects malformed slugs', async () => {
    const token = await login();

    for (const slug of ['Has Capitals', 'has space', '-leading', 'trailing-', 'under_score', 'a'.repeat(61)]) {
      const res = await createPage(token, { slug, title: 'Bad' });
      expect(res.status, `slug "${slug.slice(0, 20)}" should be rejected`).toBe(400);
    }
  });

  it('accepts a 60-character slug but not 61', async () => {
    const token = await login();
    expect((await createPage(token, { slug: 'a'.repeat(60), title: 'Long' })).status).toBe(201);
    expect((await createPage(token, { slug: 'b'.repeat(61), title: 'Too long' })).status).toBe(400);
  });

  it('refuses reserved top-level slugs', async () => {
    const token = await login();

    for (const slug of ['admin', 'api', 'login', 'assets']) {
      const res = await createPage(token, { slug, title: 'Reserved' });
      expect(res.status, `"${slug}" should be reserved`).toBe(409);
      expect(res.body.error.message).toMatch(/reserved/i);
    }
  });

  // Revised for build-order step 11. The original rule rejected `/projects` outright,
  // which over-approximated the real hazard: an index page at the namespace root is
  // unambiguous (the resolver matches it exactly, and `/projects/<slug>` still falls
  // through to the detail pattern), and the CMS cannot own the site's own listing pages
  // without it. The precise hazard — a page hiding an individual project — is covered by
  // the shadow check in the next test.
  it('allows an index page at a detail namespace root', async () => {
    const token = await login();

    const res = await createPage(token, { slug: 'projects', title: 'Projects' });
    expect(res.status).toBe(201);
    expect(res.body.path).toBe('/projects');
  });

  it('still routes /projects/<slug> to the project, not into the index page', async () => {
    const token = await login();
    await createPage(token, { slug: 'projects', title: 'Projects', status: 'PUBLISHED' });
    await Project.create({
      title: 'Payout System',
      slug: 'payout-system',
      summary: 'A payments platform.',
      description: 'A payments platform with reconciliation and ledgers.',
      status: 'PUBLISHED',
    } as never);

    expect((await request(app).get('/api/v1/resolve?path=/projects')).body.kind).toBe('PAGE');
    expect((await request(app).get('/api/v1/resolve?path=/projects/payout-system')).body.kind).toBe('PROJECT');
  });

  it('names the conflicting entry when a page would shadow a project', async () => {
    const token = await login();
    await seedProject({ slug: 'case-studies' });
    const parent = await seedPage({ slug: 'work', path: '/work' });

    // A page under /work is fine; the collision test is about the /projects namespace,
    // so move the check there via a page whose path lands under it.
    await Page.updateOne({ _id: parent._id }, { $set: { slug: 'projects', path: '/projects' } });

    const res = await createPage(token, { slug: 'case-studies', parentId: String(parent._id), title: 'Decoy' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('case-studies');
  });

  it('rejects a project whose slug would be shadowed by an existing page — the reverse check', async () => {
    const token = await login();
    await seedPage({ slug: 'projects', path: '/projects' });
    const projectsPage = await Page.findOne({ path: '/projects' });
    await seedPage({
      slug: 'reserved-slug',
      path: '/projects/reserved-slug',
      parentId: projectsPage!._id,
      depth: 1,
    });

    const res = await request(app)
      .post('/api/v1/projects')
      .set(auth(token))
      .send({
        title: 'Clashing',
        slug: 'reserved-slug',
        summary: 'A summary long enough to pass validation.',
        description: 'A description long enough to pass validation checks.',
      });

    // Blocked on both sides, so resolution never has to arbitrate.
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/would hide this project/i);
  });

  it('gives a friendly conflict rather than a raw duplicate-key error', async () => {
    const token = await login();
    await seedPage();

    const res = await createPage(token, { slug: 'guides', title: 'Guides again' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).not.toMatch(/E11000|duplicate key/i);
  });
});

describe('§4.2 hierarchy integrity', () => {
  it('refuses to move a page under its own descendant', async () => {
    const token = await login();
    const root = await seedPage();
    const child = await seedPage({ slug: 'child', path: '/guides/child', parentId: root._id, depth: 1 });

    const res = await request(app)
      .patch('/api/v1/admin/pages/tree')
      .set(auth(token))
      .send({ items: [{ id: String(root._id), parentId: String(child._id), navOrder: 0 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/under itself or its own sub-page/i);
  });

  it('refuses to make a page its own parent', async () => {
    const token = await login();
    const page = await seedPage();

    const res = await request(app)
      .patch('/api/v1/admin/pages/tree')
      .set(auth(token))
      .send({ items: [{ id: String(page._id), parentId: String(page._id), navOrder: 0 }] });

    expect(res.status).toBe(400);
  });

  it('rejects a move that would push descendants past the depth cap', async () => {
    const token = await login();
    // A two-level subtree: /a -> /a/b
    const a = await seedPage({ slug: 'a', path: '/a' });
    await seedPage({ slug: 'b', path: '/a/b', parentId: a._id, depth: 1 });
    // A separate two-level chain to move it under: /x -> /x/y
    const x = await seedPage({ slug: 'x', path: '/x' });
    const y = await seedPage({ slug: 'y', path: '/x/y', parentId: x._id, depth: 1 });

    // `a` alone would land at depth 2 (legal), but its child would reach depth 3.
    const res = await request(app)
      .patch('/api/v1/admin/pages/tree')
      .set(auth(token))
      .send({ items: [{ id: String(a._id), parentId: String(y._id), navOrder: 0 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/sub-pages deeper/i);
  });

  it('warns, without blocking, when publishing under a draft parent', async () => {
    const token = await login();
    const parent = await seedPage({ status: 'DRAFT' });
    const child = await seedPage({ slug: 'child', path: '/guides/child', parentId: parent._id, depth: 1 });

    const res = await request(app)
      .patch(`/api/v1/admin/pages/${child._id}`)
      .set(auth(token))
      .send({ slug: 'child', parentId: String(parent._id), title: 'Child', status: 'PUBLISHED' });

    expect(res.status).toBe(200);
    expect(res.body.warning).toMatch(/draft/i);
  });
});

describe('§4.3 path recomputation', () => {
  it('caps previousPaths, dropping the oldest', async () => {
    const token = await login();
    const page = await seedPage();

    // More renames than the cap allows.
    for (let i = 0; i < MAX_PREVIOUS_PATHS + 3; i++) {
      await request(app)
        .patch(`/api/v1/admin/pages/${page._id}`)
        .set(auth(token))
        .send({ slug: `rename-${i}`, title: 'Guides' });
    }

    const finalPage = await Page.findById(page._id);
    expect(finalPage!.previousPaths.length).toBeLessThanOrEqual(MAX_PREVIOUS_PATHS);
    // The oldest entry is the one dropped.
    expect(finalPage!.previousPaths).not.toContain('/guides');
    expect(finalPage!.previousPaths).toContain(`/rename-${MAX_PREVIOUS_PATHS + 1}`);
  });

  it('repaths the whole subtree, not just direct children', async () => {
    const token = await login();
    const a = await seedPage({ slug: 'a', path: '/a' });
    const b = await seedPage({ slug: 'b', path: '/a/b', parentId: a._id, depth: 1 });
    await seedPage({ slug: 'c', path: '/a/b/c', parentId: b._id, depth: 2 });

    const renamed = await request(app)
      .patch(`/api/v1/admin/pages/${a._id}`)
      .set(auth(token))
      .send({ slug: 'z', title: 'Zed' });
    expect(renamed.status).toBe(200);

    expect((await Page.findOne({ slug: 'b' }))!.path).toBe('/z/b');
    expect((await Page.findOne({ slug: 'c' }))!.path).toBe('/z/b/c');
    expect((await Page.findOne({ slug: 'c' }))!.previousPaths).toContain('/a/b/c');
  });
});

describe('§4.4 deletion', () => {
  it('refuses to delete a system page even with a strategy', async () => {
    const token = await login();
    const page = await seedPage({ isSystem: true });

    const res = await request(app)
      .delete(`/api/v1/admin/pages/${page._id}?strategy=subtree`)
      .set(auth(token));

    expect(res.status).toBe(403);
    expect(await Page.findById(page._id)).not.toBeNull();
  });

  it('demands an explicit choice when the page has children', async () => {
    const token = await login();
    const parent = await seedPage();
    await seedPage({ slug: 'child', path: '/guides/child', parentId: parent._id, depth: 1 });

    const res = await request(app).delete(`/api/v1/admin/pages/${parent._id}`).set(auth(token));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CHOICE_REQUIRED');
    expect(res.body.error.details.strategies).toEqual(['promote', 'subtree']);
    expect(res.body.error.details.children[0].path).toBe('/guides/child');
    // Nothing was deleted while the question was outstanding.
    expect(await Page.findOne({ _id: parent._id, deletedAt: null })).not.toBeNull();
  });

  it('promotes children to the deleted page\'s parent and repaths them', async () => {
    const token = await login();
    const parent = await seedPage();
    await seedPage({ slug: 'child', path: '/guides/child', parentId: parent._id, depth: 1 });

    const res = await request(app)
      .delete(`/api/v1/admin/pages/${parent._id}?strategy=promote`)
      .set(auth(token));

    expect(res.status).toBe(200);
    const child = await Page.findOne({ slug: 'child' });
    expect(child!.deletedAt).toBeNull();
    expect(child!.path).toBe('/child');
    expect(child!.depth).toBe(0);
    // The old URL still redirects.
    expect((await request(app).get('/api/v1/resolve?path=/guides/child')).body.kind).toBe('REDIRECT');
  });

  it('deletes the whole subtree when that is the chosen strategy', async () => {
    const token = await login();
    const parent = await seedPage();
    await seedPage({ slug: 'child', path: '/guides/child', parentId: parent._id, depth: 1 });

    await request(app).delete(`/api/v1/admin/pages/${parent._id}?strategy=subtree`).set(auth(token));

    expect((await Page.findOne({ slug: 'child' }))!.deletedAt).not.toBeNull();
  });

  it('soft-deletes: the row survives but disappears from every read path', async () => {
    const token = await login();
    const page = await seedPage();

    const res = await request(app).delete(`/api/v1/admin/pages/${page._id}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.restorableUntil).toBeTruthy();

    // Still in the database…
    expect(await Page.findById(page._id)).not.toBeNull();
    // …but gone from resolve, nav and sitemap.
    expect((await request(app).get('/api/v1/resolve?path=/guides')).body.kind).toBe('NOT_FOUND');
    expect((await request(app).get('/api/v1/nav')).body).toHaveLength(0);
    expect((await request(app).get('/api/v1/sitemap')).body).toHaveLength(0);
  });

  it('restores a soft-deleted page', async () => {
    const token = await login();
    const page = await seedPage();
    await request(app).delete(`/api/v1/admin/pages/${page._id}`).set(auth(token));

    const res = await request(app).post(`/api/v1/admin/pages/${page._id}/restore`).set(auth(token));

    expect(res.status).toBe(200);
    expect((await request(app).get('/api/v1/resolve?path=/guides')).body.kind).toBe('PAGE');
  });

  it('refuses to restore onto a path something else has taken', async () => {
    const token = await login();
    const page = await seedPage();
    await request(app).delete(`/api/v1/admin/pages/${page._id}`).set(auth(token));

    // A soft-deleted page must not block a replacement at the same URL.
    const replacement = await createPage(token, { slug: 'guides', title: 'New Guides' });
    expect(replacement.status).toBe(201);

    const res = await request(app).post(`/api/v1/admin/pages/${page._id}/restore`).set(auth(token));
    expect(res.status).toBe(409);
  });

  it('purges only soft-deletes past the retention window', async () => {
    const fresh = await seedPage({ slug: 'fresh', path: '/fresh', deletedAt: new Date() });
    const stale = await seedPage({
      slug: 'stale',
      path: '/stale',
      deletedAt: new Date(Date.now() - (SOFT_DELETE_RETENTION_DAYS + 1) * 86400000),
    });
    const live = await seedPage();

    const purged = await purgeExpiredDeletedPages();

    expect(purged).toBe(1);
    expect(await Page.findById(stale._id)).toBeNull();
    expect(await Page.findById(fresh._id)).not.toBeNull();
    expect(await Page.findById(live._id)).not.toBeNull();
  });
});
