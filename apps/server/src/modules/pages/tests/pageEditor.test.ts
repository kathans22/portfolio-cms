import { describe, it, expect } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { Project } from '../../projects/project.model';
import { Page, PageAttrs } from '../page.model';

async function login() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await Admin.create({ email: 'admin@portfolio.test', passwordHash, name: 'Admin' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@portfolio.test', password: 'admin123' });
  return res.body.access_token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

function seedPage(overrides: Record<string, unknown> = {}) {
  return Page.create({
    slug: 'guides',
    path: '/guides',
    title: 'Guides',
    status: 'DRAFT',
    ...overrides,
  } as unknown as PageAttrs);
}

function seedProject(overrides: Record<string, unknown> = {}) {
  return Project.create({
    title: 'Thing',
    slug: `thing-${Math.random().toString(36).slice(2, 8)}`,
    summary: 'A summary long enough to pass validation.',
    description: 'A description long enough to pass validation rules.',
    domains: ['SOFTWARE_DEVELOPMENT'],
    status: 'PUBLISHED',
    ...overrides,
  } as never);
}

describe('Section 6.2 GET /admin/pages/:id', () => {
  it('returns the page with its stored, unresolved sections', async () => {
    const token = await login();
    const page = await seedPage({
      sections: [{ type: 'PROJECT_LIST', order: 0, query: { limit: 3, featuredOnly: true } }],
    });

    const res = await request(app).get(`/api/v1/admin/pages/${page._id}`).set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.sections).toHaveLength(1);
    // The editor edits the query, so it must come back as authored — not expanded into
    // the documents it would match.
    expect(res.body.sections[0].query.limit).toBe(3);
    expect(res.body.sections[0].items).toBeUndefined();
  });

  it('404s on a malformed id instead of crashing on the cast', async () => {
    const token = await login();
    const res = await request(app).get('/api/v1/admin/pages/not-an-object-id').set(auth(token));
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const page = await seedPage();
    const res = await request(app).get(`/api/v1/admin/pages/${page._id}`);
    expect(res.status).toBe(401);
  });
});

describe('Section 6.2 POST /admin/sections/count', () => {
  it('reports matching, total and shown so a filter’s effect is visible before saving', async () => {
    const token = await login();
    await seedProject({ featured: true });
    await seedProject({ featured: true });
    await seedProject({ featured: false });
    // Drafts must never be counted: the resolver would not render them either.
    await seedProject({ featured: true, status: 'DRAFT' });

    const res = await request(app)
      .post('/api/v1/admin/sections/count')
      .set(auth(token))
      .send({ type: 'PROJECT_LIST', query: { featuredOnly: true, limit: 1 } });

    expect(res.status).toBe(200);
    expect(res.body.applicable).toBe(true);
    expect(res.body.matching).toBe(2);
    expect(res.body.total).toBe(3);
    // limit caps what renders, and is reported separately from what matched.
    expect(res.body.shown).toBe(1);
  });

  it('treats limit 0 as unlimited', async () => {
    const token = await login();
    await seedProject();
    await seedProject();

    const res = await request(app)
      .post('/api/v1/admin/sections/count')
      .set(auth(token))
      .send({ type: 'PROJECT_LIST', query: { limit: 0 } });

    expect(res.body.shown).toBe(2);
  });

  it('says a content section has nothing to count rather than reporting a bogus zero', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/v1/admin/sections/count')
      .set(auth(token))
      .send({ type: 'HERO', query: {} });

    expect(res.status).toBe(200);
    expect(res.body.applicable).toBe(false);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/admin/sections/count')
      .send({ type: 'PROJECT_LIST', query: {} });
    expect(res.status).toBe(401);
  });
});

describe('Section 7 duplicate path handling', () => {
  it('reports a database-level path collision as a 409, not a 500', async () => {
    const token = await login();
    // Reproduces what a stale non-partial `path` index does: the availability check
    // passes because the colliding row is soft-deleted, then the write is rejected by
    // the index underneath. The admin must see a conflict, not "the server broke".
    await seedPage({ slug: 'taken', path: '/taken', deletedAt: new Date() });
    await Page.collection.createIndex({ path: 1 }, { unique: true, name: 'path_1_strict' });

    const res = await request(app)
      .post('/api/v1/admin/pages')
      .set(auth(token))
      .send({ title: 'Taken Again', slug: 'taken', status: 'DRAFT' });

    await Page.collection.dropIndex('path_1_strict');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toMatch(/already taken/i);
  });
});

describe('Section 6.3 publish timestamps', () => {
  it('stamps lastPublishedAt on the transition into PUBLISHED', async () => {
    const token = await login();
    const page = await seedPage({ status: 'DRAFT' });
    expect(page.lastPublishedAt).toBeFalsy();

    const res = await request(app)
      .patch(`/api/v1/admin/pages/${page._id}`)
      .set(auth(token))
      .send({ title: 'Guides', slug: 'guides', status: 'PUBLISHED' });

    expect(res.status).toBe(200);
    expect(res.body.lastPublishedAt).toBeTruthy();
  });

  it('leaves lastPublishedAt alone when an already-published page is edited', async () => {
    const token = await login();
    const publishedAt = new Date('2026-01-01T00:00:00.000Z');
    const page = await seedPage({ status: 'PUBLISHED', lastPublishedAt: publishedAt });

    const res = await request(app)
      .patch(`/api/v1/admin/pages/${page._id}`)
      .set(auth(token))
      .send({ title: 'Guides Renamed', slug: 'guides', status: 'PUBLISHED' });

    expect(res.status).toBe(200);
    // If a plain edit bumped this, "unpublished edits pending" — the whole point of the
    // separate field — would never be true.
    expect(new Date(res.body.lastPublishedAt).toISOString()).toBe(publishedAt.toISOString());
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(publishedAt.getTime());
  });

  it('does not stamp lastPublishedAt when saving sections', async () => {
    const token = await login();
    const page = await seedPage({ status: 'DRAFT' });

    const res = await request(app)
      .put(`/api/v1/admin/pages/${page._id}/sections`)
      .set(auth(token))
      .send({ sections: [{ type: 'HERO', heading: 'Hi' }] });

    expect(res.status).toBe(200);
    expect(res.body.lastPublishedAt).toBeFalsy();
  });

  it('renumbers section order from array position, so a drag-reorder needs no client bookkeeping', async () => {
    const token = await login();
    const page = await seedPage();

    const res = await request(app)
      .put(`/api/v1/admin/pages/${page._id}/sections`)
      .set(auth(token))
      .send({
        sections: [
          { type: 'HERO', order: 99 },
          { type: 'RICH_CONTENT', order: 99 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.sections.map((s: { order: number }) => s.order)).toEqual([0, 1]);
  });
});
