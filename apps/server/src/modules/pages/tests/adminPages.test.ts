import { describe, it, expect } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { Project } from '../../projects/project.model';
import { Page, PageAttrs } from '../page.model';
import { normalizePath } from '../../resolve/resolve.service';

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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('§3.1 path normalization', () => {
  it('collapses duplicate slashes', () => {
    expect(normalizePath('/a//b')).toBe('/a/b');
    expect(normalizePath('//a///b//')).toBe('/a/b');
  });

  it('rejects traversal segments rather than normalizing them away', () => {
    expect(normalizePath('/a/../b')).toBeNull();
    expect(normalizePath('/../etc')).toBeNull();
  });
});

describe('§3.1 caching on public page responses', () => {
  it('sends Cache-Control and a strong ETag, and answers a revalidation with 304', async () => {
    await seedPage();

    const first = await request(app).get('/api/v1/resolve?path=/guides');
    expect(first.status).toBe(200);
    // Section 7 replaced must-revalidate with stale-while-revalidate: the server-side
    // cache is now busted explicitly on a write, so a shared cache is safe to serve a
    // stale copy while it refreshes rather than making a visitor wait on a cold start.
    expect(first.headers['cache-control']).toContain('stale-while-revalidate');
    expect(first.headers.etag).toMatch(/^"[a-f0-9]{40}"$/);

    const revalidated = await request(app)
      .get('/api/v1/resolve?path=/guides')
      .set('If-None-Match', first.headers.etag);

    expect(revalidated.status).toBe(304);
  });

  it('changes the ETag when the page content changes', async () => {
    const page = await seedPage();
    const before = (await request(app).get('/api/v1/resolve?path=/guides')).headers.etag;

    page.title = 'Guides, revised';
    await page.save();

    const after = (await request(app).get('/api/v1/resolve?path=/guides')).headers.etag;
    expect(after).not.toBe(before);
  });

  it('never caches a preview response', async () => {
    const token = await login();
    await seedPage({ status: 'DRAFT' });

    const res = await request(app).get('/api/v1/resolve?path=/guides&preview=true').set(auth(token));

    expect(res.body.kind).toBe('PAGE');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rejects a traversal path with 400', async () => {
    const res = await request(app).get('/api/v1/resolve?path=/a/../b');
    expect(res.status).toBe(400);
  });
});

describe('§3.3 GET /nav', () => {
  it('returns a nested tree of published, nav-visible pages', async () => {
    const parent = await seedPage({ navOrder: 0 });
    await seedPage({ slug: 'one', path: '/guides/one', parentId: parent._id, depth: 1, navOrder: 1 });
    await seedPage({ slug: 'two', path: '/guides/two', parentId: parent._id, depth: 1, navOrder: 0 });
    await seedPage({ slug: 'hidden', path: '/hidden', showInNav: false });
    await seedPage({ slug: 'draft', path: '/draft', status: 'DRAFT' });

    const res = await request(app).get('/api/v1/nav');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].path).toBe('/guides');
    // Children come back sorted by navOrder, not insertion order.
    expect(res.body[0].children.map((c: { path: string }) => c.path)).toEqual(['/guides/two', '/guides/one']);
  });

  it('prefers navLabel over title when set', async () => {
    await seedPage({ navLabel: 'Docs' });

    const res = await request(app).get('/api/v1/nav');
    expect(res.body[0].label).toBe('Docs');
  });
});

describe('§3.3 GET /sitemap', () => {
  it('returns published paths with a lastmod, excluding noIndex pages', async () => {
    await seedPage();
    await seedPage({ slug: 'secret', path: '/secret', noIndex: true });
    await seedPage({ slug: 'draft', path: '/draft', status: 'DRAFT' });

    const res = await request(app).get('/api/v1/sitemap');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].path).toBe('/guides');
    expect(res.body[0].lastmod).toBeTruthy();
  });
});

describe('§3.3 admin pages API', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/v1/admin/pages')).status).toBe(401);
    expect((await request(app).post('/api/v1/admin/pages').send({})).status).toBe(401);
  });

  it('derives the path from the parent chain rather than trusting the client', async () => {
    const token = await login();
    const parent = await seedPage();

    const res = await request(app)
      .post('/api/v1/admin/pages')
      .set(auth(token))
      .send({ slug: 'nested', parentId: String(parent._id), title: 'Nested', path: '/attacker-controlled' });

    expect(res.status).toBe(201);
    expect(res.body.path).toBe('/guides/nested');
    expect(res.body.depth).toBe(1);
  });

  it('refuses a page whose path would shadow an existing project', async () => {
    const token = await login();
    await Project.create({
      title: 'Payout System',
      slug: 'payout-system',
      summary: 'A payments platform.',
      description: 'A payments platform with reconciliation and ledgers.',
      status: 'PUBLISHED',
    } as never);
    const projects = await seedPage({ slug: 'projects', path: '/projects' });

    const res = await request(app)
      .post('/api/v1/admin/pages')
      .set(auth(token))
      .send({ slug: 'payout-system', parentId: String(projects._id), title: 'Decoy' });

    // Pages win at resolution time, so this would permanently hide the project.
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/would hide it/i);
  });

  it('rejects a duplicate path', async () => {
    const token = await login();
    await seedPage();

    const res = await request(app)
      .post('/api/v1/admin/pages')
      .set(auth(token))
      .send({ slug: 'guides', title: 'Guides again' });

    expect(res.status).toBe(409);
  });

  it('reports slug availability while typing', async () => {
    const token = await login();
    await seedPage();

    const taken = await request(app).get('/api/v1/admin/pages/validate-slug?slug=guides').set(auth(token));
    expect(taken.body).toMatchObject({ available: false, path: '/guides' });

    const free = await request(app).get('/api/v1/admin/pages/validate-slug?slug=handbook').set(auth(token));
    expect(free.body).toMatchObject({ available: true, path: '/handbook' });
  });

  it('recomputes descendant paths on rename and leaves redirects behind', async () => {
    const token = await login();
    const parent = await seedPage();
    await seedPage({ slug: 'one', path: '/guides/one', parentId: parent._id, depth: 1 });

    const res = await request(app)
      .patch(`/api/v1/admin/pages/${parent._id}`)
      .set(auth(token))
      .send({ slug: 'handbook', title: 'Handbook' });

    expect(res.status).toBe(200);
    expect(res.body.path).toBe('/handbook');
    expect(res.body.previousPaths).toContain('/guides');

    const child = await Page.findOne({ slug: 'one' });
    expect(child!.path).toBe('/handbook/one');
    expect(child!.previousPaths).toContain('/guides/one');

    // Both old URLs still resolve, as 301s.
    for (const oldPath of ['/guides', '/guides/one']) {
      const resolved = await request(app).get(`/api/v1/resolve?path=${oldPath}`);
      expect(resolved.body.kind).toBe('REDIRECT');
    }
  });

  it('does not clear sections on a metadata PATCH', async () => {
    const token = await login();
    const page = await seedPage({ sections: [{ type: 'HERO', order: 0 }] });

    await request(app)
      .patch(`/api/v1/admin/pages/${page._id}`)
      .set(auth(token))
      .send({ slug: 'guides', title: 'Renamed' });

    expect((await Page.findById(page._id))!.sections).toHaveLength(1);
  });

  it('replaces the whole sections array and renumbers order from position', async () => {
    const token = await login();
    const page = await seedPage({ sections: [{ type: 'HERO', order: 0 }] });

    const res = await request(app)
      .put(`/api/v1/admin/pages/${page._id}/sections`)
      .set(auth(token))
      .send({
        sections: [
          { type: 'CTA_BANNER', order: 99 },
          { type: 'RICH_CONTENT', order: 99 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.sections.map((s: { type: string; order: number }) => [s.type, s.order])).toEqual([
      ['CTA_BANNER', 0],
      ['RICH_CONTENT', 1],
    ]);
  });

  it('rejects a section whose layout variant is not in the registry', async () => {
    const token = await login();
    const page = await seedPage();

    const res = await request(app)
      .put(`/api/v1/admin/pages/${page._id}/sections`)
      .set(auth(token))
      .send({ sections: [{ type: 'HERO', layoutVariant: 'not-a-variant' }] });

    expect(res.status).toBe(400);
  });

  it('reparents from the tree endpoint and repaths the moved subtree', async () => {
    const token = await login();
    const a = await seedPage({ slug: 'a', path: '/a' });
    const b = await seedPage({ slug: 'b', path: '/b' });

    const res = await request(app)
      .patch('/api/v1/admin/pages/tree')
      .set(auth(token))
      .send({ items: [{ id: String(b._id), parentId: String(a._id), navOrder: 0 }] });

    expect(res.status).toBe(200);
    expect((await Page.findById(b._id))!.path).toBe('/a/b');
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

  it('duplicates a page as an unpublished copy that owns no redirects', async () => {
    const token = await login();
    const page = await seedPage({ previousPaths: ['/old-guides'], sections: [{ type: 'HERO', order: 0 }] });

    const res = await request(app).post(`/api/v1/admin/pages/${page._id}/duplicate`).set(auth(token));

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('guides-copy');
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.sections).toHaveLength(1);
    // Inheriting previousPaths would hijack the original's URLs.
    expect(res.body.previousPaths).toEqual([]);
  });

  it('refuses to delete a system page', async () => {
    const token = await login();
    const page = await seedPage({ isSystem: true });

    const res = await request(app).delete(`/api/v1/admin/pages/${page._id}`).set(auth(token));

    expect(res.status).toBe(403);
  });

  it('refuses to delete a page that still has sub-pages, naming the count', async () => {
    const token = await login();
    const parent = await seedPage();
    await seedPage({ slug: 'one', path: '/guides/one', parentId: parent._id, depth: 1 });

    const res = await request(app).delete(`/api/v1/admin/pages/${parent._id}`).set(auth(token));

    expect(res.status).toBe(409);
    expect(res.body.error.details.descendants).toBe(1);
  });

  it('soft-deletes a leaf page, keeping it restorable', async () => {
    const token = await login();
    const page = await seedPage();

    const res = await request(app).delete(`/api/v1/admin/pages/${page._id}`).set(auth(token));

    expect(res.status).toBe(200);
    // Soft delete: the row survives for the restore window (see §4.4 tests).
    expect((await Page.findById(page._id))!.deletedAt).not.toBeNull();
    expect((await request(app).get('/api/v1/resolve?path=/guides')).body.kind).toBe('NOT_FOUND');
  });

  it('returns both a flat list and a tree', async () => {
    const token = await login();
    const parent = await seedPage();
    await seedPage({ slug: 'one', path: '/guides/one', parentId: parent._id, depth: 1 });

    const res = await request(app).get('/api/v1/admin/pages').set(auth(token));

    expect(res.body.items).toHaveLength(2);
    expect(res.body.tree).toHaveLength(1);
    expect(res.body.tree[0].children).toHaveLength(1);
  });
});
