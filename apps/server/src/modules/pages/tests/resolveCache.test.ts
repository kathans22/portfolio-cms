import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { Project } from '../../projects/project.model';
import { Testimonial } from '../../testimonials/testimonial.model';
import { Page, PageAttrs } from '../page.model';
import { clearResolveCache, resolveCacheStats } from '../../resolve/resolveCache';

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
    slug: 'work',
    path: '/work',
    title: 'Work',
    status: 'PUBLISHED',
    sections: [{ type: 'PROJECT_LIST', order: 0, layoutVariant: 'grid' }],
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

const get = (path: string) => request(app).get(`/api/v1/resolve?path=${encodeURIComponent(path)}`);

// Each test starts from a cold cache; the cache is process-global by design.
beforeEach(() => clearResolveCache());

describe('Section 7 resolve cache', () => {
  it('serves a second identical request from memory', async () => {
    await seedPage();

    const first = await get('/work');
    expect(first.status).toBe(200);
    expect(first.headers['x-cache']).toBe('MISS');

    const second = await get('/work');
    expect(second.status).toBe(200);
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body).toEqual(first.body);
    expect(resolveCacheStats().hits).toBeGreaterThan(0);
  });

  it('sends stale-while-revalidate so a cold start never blocks a visitor', async () => {
    await seedPage();
    const res = await get('/work');
    expect(res.headers['cache-control']).toBe('public, max-age=60, stale-while-revalidate=300');
    expect(res.headers.etag).toMatch(/^"[a-f0-9]{40}"$/);
  });

  it('answers a revalidation with 304 from the cache too', async () => {
    await seedPage();
    const first = await get('/work');

    const revalidated = await get('/work').set('If-None-Match', first.headers.etag);
    expect(revalidated.status).toBe(304);
    expect(revalidated.headers['x-cache']).toBe('HIT');
  });

  it('busts the page when the page itself is published through', async () => {
    const token = await login();
    const page = await seedPage({ status: 'DRAFT' });

    expect((await get('/work')).body.kind).toBe('NOT_FOUND');

    await request(app)
      .patch(`/api/v1/admin/pages/${page._id}`)
      .set(auth(token))
      .send({ title: 'Work', slug: 'work', status: 'PUBLISHED' });

    // Without invalidation this would still be the cached NOT_FOUND for up to a minute,
    // and the admin would reasonably conclude the publish failed.
    const after = await get('/work');
    expect(after.body.kind).toBe('PAGE');
  });

  it('busts a page when a collection it queries is written', async () => {
    await seedPage();
    await seedProject({ title: 'First' });

    const before = await get('/work');
    expect(before.body.data.sections[0].items).toHaveLength(1);

    // A Project write must reach the cached /work page that lists projects, not just
    // /projects/<slug>.
    await seedProject({ title: 'Second' });

    const after = await get('/work');
    expect(after.headers['x-cache']).toBe('MISS');
    expect(after.body.data.sections[0].items).toHaveLength(2);
  });

  it('leaves a page cached when an unrelated collection is written', async () => {
    await seedPage();
    await get('/work');

    // /work has no testimonial section, so this write is none of its business.
    await Testimonial.create({ name: 'A', role: 'B', quote: 'C' } as never);

    const after = await get('/work');
    expect(after.headers['x-cache']).toBe('HIT');
  });

  it('never serves a preview from the cache, nor writes one into it', async () => {
    const token = await login();
    await seedPage({ status: 'DRAFT' });

    const preview = await request(app)
      .get('/api/v1/resolve?path=/work&preview=true')
      .set(auth(token));
    expect(preview.body.kind).toBe('PAGE');
    expect(preview.headers['cache-control']).toBe('no-store');
    expect(preview.headers['x-cache']).toBeUndefined();

    // The draft must not have leaked into the cache the public read shares.
    expect((await get('/work')).body.kind).toBe('NOT_FOUND');
  });
});

describe('Section 7 derived list cache (/nav, /sitemap)', () => {
  const getNav = () => request(app).get('/api/v1/nav');
  const getSitemap = () => request(app).get('/api/v1/sitemap');

  it('serves /nav from memory on the second hit', async () => {
    await seedPage();

    expect((await getNav()).headers['x-cache']).toBe('MISS');
    expect((await getNav()).headers['x-cache']).toBe('HIT');
  });

  it('sends the short derived Cache-Control, not the page one', async () => {
    await seedPage();
    const res = await getNav();
    expect(res.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=120');
  });

  it('busts a warm /nav when a page it lists is deleted', async () => {
    const token = await login();
    const page = await seedPage();

    expect((await getNav()).body).toHaveLength(1);
    expect((await getNav()).headers['x-cache']).toBe('HIT'); // cache is now warm

    await request(app).delete(`/api/v1/admin/pages/${page._id}`).set(auth(token));

    const after = await getNav();
    // Without derived-cache invalidation this stays the warm 1-entry tree for up to a
    // minute, and the deleted page keeps showing in the visitor's menu.
    expect(after.headers['x-cache']).toBe('MISS');
    expect(after.body).toHaveLength(0);
  });

  it('busts a warm /sitemap when a page is published through', async () => {
    const token = await login();
    const page = await seedPage({ status: 'DRAFT' });

    expect((await getSitemap()).body).toHaveLength(0); // warms the cache on a draft

    await request(app)
      .patch(`/api/v1/admin/pages/${page._id}`)
      .set(auth(token))
      .send({ title: 'Work', slug: 'work', status: 'PUBLISHED' });

    expect((await getSitemap()).body).toHaveLength(1);
  });

  it('leaves a warm /nav alone when an unrelated collection is written', async () => {
    await seedPage();
    await getNav();

    // Nav is built from Page only — a Project write is none of its business.
    await seedProject();

    expect((await getNav()).headers['x-cache']).toBe('HIT');
  });
});

describe('Section 7 public projections', () => {
  it('projects only the fields a project card renders', async () => {
    await seedPage();
    await seedProject({ metaTitle: 'private-ish', description: 'Long internal description.' });

    const res = await get('/work');
    const item = res.body.data.sections[0].items[0];

    expect(item.title).toBeDefined();
    expect(item.slug).toBeDefined();
    expect(item.summary).toBeDefined();
    // Never return whole documents: a field added to the model later must stay private
    // until someone puts it in the projection deliberately.
    expect(item.description).toBeUndefined();
    expect(item.contentBlocks).toBeUndefined();
    expect(item.metaTitle).toBeUndefined();
    expect(item.status).toBeUndefined();
  });

  it('projects only the fields a sub-page link renders', async () => {
    const parent = await seedPage({ slug: 'guides', path: '/guides', sections: [{ type: 'CHILD_PAGE_LIST', order: 0, layoutVariant: 'cards' }] });
    await Page.create({
      slug: 'deploying', path: '/guides/deploying', parentId: parent._id, depth: 1,
      title: 'Deploying', status: 'PUBLISHED', metaDescription: 'How to deploy.',
      sections: [{ type: 'HERO', order: 0 }],
    } as unknown as PageAttrs);

    const res = await get('/guides');
    const child = res.body.data.sections[0].items[0];

    expect(child.path).toBe('/guides/deploying');
    expect(child.title).toBe('Deploying');
    // A child link renders a title and a description — never the child's whole section
    // tree, which would multiply the payload for content that isn't shown.
    expect(child.sections).toBeUndefined();
  });
});
