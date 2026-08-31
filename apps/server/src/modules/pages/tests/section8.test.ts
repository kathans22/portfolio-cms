/**
 * Section 8 conformance suite.
 *
 * One test per stated guarantee, in the order they were specified, so the checklist can
 * be verified at a glance. Several of these are also exercised from a different angle in
 * resolve.test.ts, guardrails.test.ts and adminPages.test.ts; the duplication is
 * deliberate, because this file is the list of promises the CMS makes about URLs, and a
 * promise that is only tested incidentally is easy to break during a refactor.
 *
 * Every test here has been mutation-checked: breaking the behaviour it names makes this
 * file fail and, in most cases, only this file.
 */
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

type Overrides = Record<string, unknown>;

function makePage(overrides: Overrides = {}) {
  return Page.create({
    slug: 'guides',
    path: '/guides',
    title: 'Guides',
    status: 'PUBLISHED',
    ...overrides,
  } as unknown as PageAttrs);
}

function makeProject(overrides: Overrides = {}) {
  return Project.create({
    title: 'Payout System',
    slug: 'payout-system',
    summary: 'A payments platform.',
    description: 'A payments platform with reconciliation and ledgers.',
    status: 'PUBLISHED',
    ...overrides,
  } as never);
}

const resolve = (path: string, token?: string, preview = false) => {
  const req = request(app).get(
    `/api/v1/resolve?path=${encodeURIComponent(path)}${preview ? '&preview=true' : ''}`
  );
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

// 1 ---------------------------------------------------------------------------
describe('8.1 resolver precedence', () => {
  it('a page at /projects/case-studies wins over the project detail pattern', async () => {
    // The exact ambiguity the resolver exists to remove: both of these are
    // /projects/<something>, and the router cannot tell them apart on its own because
    // admin-authored paths are not known at build time.
    await makePage({ slug: 'case-studies', path: '/projects/case-studies', title: 'Case Studies' });
    await makeProject({ slug: 'case-studies', title: 'Decoy Project' });

    const res = await resolve('/projects/case-studies');

    expect(res.body.kind).toBe('PAGE');
    expect(res.body.data.title).toBe('Case Studies');
  });
});

// 2 ---------------------------------------------------------------------------
describe('8.2 slug rename leaves a redirect', () => {
  it('pushes the old path to previousPaths and 301s it afterwards', async () => {
    const token = await login();
    const page = await makePage();

    const renamed = await request(app)
      .patch(`/api/v1/admin/pages/${page._id}`)
      .set(auth(token))
      .send({ slug: 'handbook', title: 'Handbook' });

    expect(renamed.status).toBe(200);
    expect(renamed.body.path).toBe('/handbook');
    expect(renamed.body.previousPaths).toContain('/guides');

    // Asserting the whole envelope, not just the kind: a redirect that points at the
    // wrong target, or answers 302, is a different bug that "kind === REDIRECT" hides.
    const old = await resolve('/guides');
    expect(old.body).toEqual({ kind: 'REDIRECT', to: '/handbook', status: 301 });

    expect((await resolve('/handbook')).body.kind).toBe('PAGE');
  });

  it('does not unpublish or reset nav settings when the PATCH omits those fields', async () => {
    const token = await login();
    const page = await makePage({ status: 'PUBLISHED', showInNav: false, noIndex: true, navOrder: 7 });

    // A partial PATCH. Validating this against the create schema would fill the missing
    // keys with its defaults — silently unpublishing the page and undoing every nav and
    // SEO choice — which would also leave 8.2's redirect pointing at a 404.
    await request(app)
      .patch(`/api/v1/admin/pages/${page._id}`)
      .set(auth(token))
      .send({ slug: 'handbook', title: 'Handbook' });

    const saved = (await Page.findById(page._id))!;
    expect(saved.status).toBe('PUBLISHED');
    expect(saved.showInNav).toBe(false);
    expect(saved.noIndex).toBe(true);
    expect(saved.navOrder).toBe(7);
  });
});

// 3 ---------------------------------------------------------------------------
describe('8.3 parent rename cascades', () => {
  it('recomputes every descendant path and preserves each descendant redirect', async () => {
    const token = await login();
    const a = await makePage({ slug: 'a', path: '/a', title: 'A' });
    const b = await makePage({ slug: 'b', path: '/a/b', title: 'B', parentId: a._id, depth: 1 });
    await makePage({ slug: 'c', path: '/a/b/c', title: 'C', parentId: b._id, depth: 2 });

    const renamed = await request(app)
      .patch(`/api/v1/admin/pages/${a._id}`)
      .set(auth(token))
      .send({ slug: 'z', title: 'Zed' });
    expect(renamed.status).toBe(200);

    expect((await Page.findOne({ slug: 'b' }))!.path).toBe('/z/b');
    // The grandchild proves the walk is recursive, not one level deep.
    expect((await Page.findOne({ slug: 'c' }))!.path).toBe('/z/b/c');

    // Every old URL in the subtree must still resolve, each to its own new home —
    // checking the stored previousPaths array is not the same as checking that a
    // visitor following an old link actually arrives somewhere.
    const expected: [string, string][] = [
      ['/a', '/z'],
      ['/a/b', '/z/b'],
      ['/a/b/c', '/z/b/c'],
    ];
    for (const [oldPath, newPath] of expected) {
      const res = await resolve(oldPath);
      expect(res.body).toEqual({ kind: 'REDIRECT', to: newPath, status: 301 });
    }
  });
});

// 4 ---------------------------------------------------------------------------
describe('8.4 reparenting under a descendant', () => {
  it('is rejected', async () => {
    const token = await login();
    const parent = await makePage({ slug: 'parent', path: '/parent', title: 'Parent' });
    const child = await makePage({ slug: 'child', path: '/parent/child', title: 'Child', parentId: parent._id, depth: 1 });

    const res = await request(app)
      .patch(`/api/v1/admin/pages/${parent._id}`)
      .set(auth(token))
      .send({ slug: 'parent', title: 'Parent', parentId: String(child._id) });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/itself or its own sub-page/i);
    // And nothing moved.
    expect((await Page.findById(parent._id))!.path).toBe('/parent');
  });
});

// 5 ---------------------------------------------------------------------------
describe('8.5 depth cap on reparenting', () => {
  it('rejects a move that would push a subtree past depth 2', async () => {
    const token = await login();
    // A two-deep subtree: moving `top` under `host` would put `mid` at depth 3.
    const top = await makePage({ slug: 'top', path: '/top', title: 'Top' });
    await makePage({ slug: 'mid', path: '/top/mid', title: 'Mid', parentId: top._id, depth: 1 });
    const host = await makePage({ slug: 'host', path: '/host', title: 'Host' });
    const nested = await makePage({ slug: 'nested', path: '/host/nested', title: 'Nested', parentId: host._id, depth: 1 });

    const res = await request(app)
      .patch(`/api/v1/admin/pages/${top._id}`)
      .set(auth(token))
      .send({ slug: 'top', title: 'Top', parentId: String(nested._id) });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/deeper than/i);
    // The check must consider the deepest descendant, not just the moved node — `top`
    // alone would have fitted.
    expect((await Page.findById(top._id))!.path).toBe('/top');
  });
});

// 6 ---------------------------------------------------------------------------
describe('8.6 reserved slugs and collection collisions', () => {
  it('rejects a reserved top-level slug', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/v1/admin/pages')
      .set(auth(token))
      .send({ title: 'Admin Panel', slug: 'admin' });

    expect(res.status).toBe(409);
  });

  it('rejects a page whose path would shadow an existing project', async () => {
    const token = await login();
    await makeProject({ slug: 'payout-system' });
    const parent = await makePage({ slug: 'projects', path: '/projects', title: 'Projects' });

    const res = await request(app)
      .post('/api/v1/admin/pages')
      .set(auth(token))
      .send({ title: 'Payout System', slug: 'payout-system', parentId: String(parent._id) });

    expect(res.status).toBe(409);
  });

  it('rejects a project whose slug would be shadowed by an existing page — the reverse direction', async () => {
    const token = await login();
    const parent = await makePage({ slug: 'projects', path: '/projects', title: 'Projects' });
    await makePage({ slug: 'taken', path: '/projects/taken', title: 'Taken', parentId: parent._id, depth: 1 });

    // Blocking only one direction leaves the collision reachable from the other side.
    const res = await request(app)
      .post('/api/v1/projects')
      .set(auth(token))
      .send({
        title: 'Taken',
        slug: 'taken',
        summary: 'A summary long enough to pass validation.',
        description: 'A description long enough to pass validation rules.',
        domains: ['SOFTWARE_DEVELOPMENT'],
        status: 'PUBLISHED',
      });

    expect(res.status).toBe(409);
  });
});

// 7 ---------------------------------------------------------------------------
describe('8.7 system pages', () => {
  it('returns 403 on delete even with a valid admin token', async () => {
    const token = await login();
    const page = await makePage({ isSystem: true });

    const res = await request(app)
      .delete(`/api/v1/admin/pages/${page._id}?strategy=subtree`)
      .set(auth(token));

    // Authorisation is not the question here — this page backs a built-in route, so no
    // token is sufficient.
    expect(res.status).toBe(403);
    expect(await Page.findById(page._id)).not.toBeNull();
  });
});

// 8 ---------------------------------------------------------------------------
describe('8.8 deleting a parent with the promote strategy', () => {
  it('reparents the children correctly and rewrites their paths', async () => {
    const token = await login();
    const grandparent = await makePage({ slug: 'top', path: '/top', title: 'Top' });
    const parent = await makePage({ slug: 'mid', path: '/top/mid', title: 'Mid', parentId: grandparent._id, depth: 1 });
    const child = await makePage({ slug: 'leaf', path: '/top/mid/leaf', title: 'Leaf', parentId: parent._id, depth: 2 });

    // The strategy is a query parameter, not a body field — a DELETE body is widely
    // dropped by proxies and by some HTTP clients.
    const res = await request(app)
      .delete(`/api/v1/admin/pages/${parent._id}?strategy=promote`)
      .set(auth(token));
    expect(res.status).toBe(200);

    const promoted = (await Page.findById(child._id))!;
    expect(String(promoted.parentId)).toBe(String(grandparent._id));
    // A child that keeps its old path after its parent is gone points at a URL that no
    // longer has an owner.
    expect(promoted.path).toBe('/top/leaf');
    expect(promoted.depth).toBe(1);

    expect((await resolve('/top/leaf')).body.kind).toBe('PAGE');
  });
});

// 9 ---------------------------------------------------------------------------
describe('8.9 unknown section types', () => {
  it('skips the unknown section and still renders the rest of the page', async () => {
    await makePage({
      path: '/mixed',
      slug: 'mixed',
      sections: [
        { type: 'HERO', heading: 'First', order: 0 },
        // Written by an older deploy whose registry had this type.
        { type: 'RETIRED_WIDGET', heading: 'Gone', order: 1 },
        { type: 'RICH_CONTENT', heading: 'Third', order: 2 },
      ],
    });

    const res = await resolve('/mixed');

    expect(res.status).toBe(200);
    const types = res.body.data.sections.map((s: { type: string }) => s.type);
    // Dropping the page entirely, or rendering a broken section, both turn a registry
    // change into an outage.
    expect(types).toEqual(['HERO', 'RICH_CONTENT']);
  });
});

// 10 --------------------------------------------------------------------------
describe('8.10 published-only collection items', () => {
  it('enforces status PUBLISHED even when the stored query attempts otherwise', async () => {
    const token = await login();
    await makeProject({ slug: 'live', title: 'Live', status: 'PUBLISHED' });
    await makeProject({ slug: 'wip', title: 'WIP', status: 'DRAFT' });

    // A query object written straight into the database, bypassing the Zod layer that
    // would have stripped these keys — the guarantee has to hold in the resolver, not
    // only at the API boundary.
    await Page.collection.insertOne({
      slug: 'work',
      path: '/work',
      title: 'Work',
      status: 'PUBLISHED',
      parentId: null,
      depth: 0,
      previousPaths: [],
      showInNav: true,
      navOrder: 0,
      isSystem: false,
      noIndex: false,
      deletedAt: null,
      sections: [
        {
          type: 'PROJECT_LIST',
          isVisible: true,
          order: 0,
          layoutVariant: 'grid',
          query: { status: 'DRAFT', limit: 0, sortBy: 'order', sortDir: 'asc' },
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const items = (await resolve('/work')).body.data.sections[0].items;
    expect(items.map((p: { title: string }) => p.title)).toEqual(['Live']);

    // And the same holds inside an authenticated preview: previewing an unpublished
    // page must not reveal unpublished content.
    const previewed = await resolve('/work', token, true);
    expect(previewed.body.data.sections[0].items.map((p: { title: string }) => p.title)).toEqual(['Live']);
  });
});

// 11 --------------------------------------------------------------------------
describe('8.11 draft page visibility', () => {
  it('returns NOT_FOUND publicly and the page in an authenticated preview', async () => {
    const token = await login();
    await makePage({ status: 'DRAFT' });

    expect((await resolve('/guides')).body).toEqual({ kind: 'NOT_FOUND' });

    const previewed = await resolve('/guides', token, true);
    expect(previewed.body.kind).toBe('PAGE');
    expect(previewed.body.data.title).toBe('Guides');

    // preview=true is not a bearer token: without one it must change nothing.
    expect((await resolve('/guides', undefined, true)).body).toEqual({ kind: 'NOT_FOUND' });
  });
});

// 12 --------------------------------------------------------------------------
describe('8.12 path normalization', () => {
  it('resolves /About/ and /about identically', async () => {
    await makePage({ slug: 'about', path: '/about', title: 'About' });

    const canonical = await resolve('/about');
    expect(canonical.body.kind).toBe('PAGE');

    // Identical payloads, not merely "both are pages" — if the variants resolved to
    // different documents, or one carried a different canonical path, the site would
    // accumulate duplicate URLs for the same content.
    for (const variant of ['/About/', '/About', '/about/', '/ABOUT//']) {
      const res = await resolve(variant);
      expect(res.body).toEqual(canonical.body);
    }
  });
});
