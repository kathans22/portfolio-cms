import { describe, it, expect } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { Project } from '../../projects/project.model';
import { BlogPost } from '../../blog/blogPost.model';
import { Certification } from '../../certifications/certification.model';
import { Page, PageAttrs } from '../page.model';
import { normalizePath } from '../../resolve/resolve.service';

async function createAdminAndLogin() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await Admin.create({ email: 'admin@portfolio.test', passwordHash, name: 'Admin' });
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@portfolio.test', password: 'admin123' });
  return login.body.access_token as string;
}

// Mongoose fills schema defaults on insert, so a create payload is legitimately
// narrower than the stored shape — and spreading overrides widens literal enum types
// to `unknown`. One cast inside each helper beats loosening the models' own types.
type Overrides = Record<string, unknown>;

function createPage(overrides: Overrides = {}) {
  return Page.create({
    slug: 'case-studies',
    path: '/projects/case-studies',
    title: 'Case Studies',
    status: 'PUBLISHED',
    ...overrides,
  } as unknown as PageAttrs);
}

function createProject(overrides: Overrides = {}) {
  return Project.create({
    title: 'Payout System',
    slug: 'payout-system',
    summary: 'A payments platform.',
    description: 'A payments platform with reconciliation and ledgers.',
    status: 'PUBLISHED',
    ...overrides,
  } as never);
}

function createCertification(overrides: Overrides = {}) {
  return Certification.create({
    name: 'AWS SAA',
    issuingOrganization: 'Amazon Web Services',
    issueDate: new Date('2025-01-01'),
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

describe('normalizePath', () => {
  it('lowercases, adds a leading slash and strips trailing slashes', () => {
    expect(normalizePath('/About/')).toBe('/about');
    expect(normalizePath('about')).toBe('/about');
    expect(normalizePath('/Projects/Case-Studies//')).toBe('/projects/case-studies');
  });

  it('preserves the root path', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });
});

describe('§0 URL resolution precedence', () => {
  it('1. an exact Page path wins over a same-shaped detail slug', async () => {
    // The ambiguity the resolver exists to remove: both of these are /projects/<x>.
    await createPage();
    await createProject({ slug: 'case-studies', title: 'Decoy Project' });

    const res = await resolve('/projects/case-studies');

    expect(res.body.kind).toBe('PAGE');
    expect(res.body.data.title).toBe('Case Studies');
  });

  it('2. a previous path redirects permanently, and beats a detail lookup', async () => {
    await createPage({ path: '/projects/new-home', previousPaths: ['/projects/old-home'] });
    // A project sitting on the vacated slug must not capture the old URL.
    await createProject({ slug: 'old-home' });

    const res = await resolve('/projects/old-home');

    expect(res.body).toEqual({ kind: 'REDIRECT', to: '/projects/new-home', status: 301 });
  });

  it('3. falls through to a typed project lookup when no page claims the path', async () => {
    await createProject();

    const res = await resolve('/projects/payout-system');

    expect(res.body.kind).toBe('PROJECT');
    expect(res.body.data.slug).toBe('payout-system');
  });

  it('3. falls through to a typed blog lookup', async () => {
    await BlogPost.create({
      slug: 'hello-world',
      title: 'Hello World',
      excerpt: 'An introduction to the blog.',
      content: 'Long-form content that comfortably exceeds the minimum length.',
      status: 'PUBLISHED',
    });

    const res = await resolve('/blog/hello-world');

    expect(res.body.kind).toBe('BLOG_POST');
    expect(res.body.data.slug).toBe('hello-world');
  });

  it('4. returns NOT_FOUND when nothing owns the URL', async () => {
    const res = await resolve('/projects/does-not-exist');
    expect(res.body).toEqual({ kind: 'NOT_FOUND' });
  });

  it('resolves case and trailing-slash variants to the same page', async () => {
    await createPage({ path: '/about', slug: 'about' });

    for (const variant of ['/about', '/About', '/about/', '/ABOUT//']) {
      expect((await resolve(variant)).body.kind).toBe('PAGE');
    }
  });

  it('does not treat a nested path as a detail slug', async () => {
    await createProject({ slug: 'payout-system' });

    // Two segments after the prefix — a detail slug is a single segment, so this must
    // not match the project.
    const res = await resolve('/projects/payout-system/extra');

    expect(res.body.kind).toBe('NOT_FOUND');
  });
});

describe('§0 draft visibility', () => {
  it('hides a draft page from the public', async () => {
    await createPage({ status: 'DRAFT' });

    expect((await resolve('/projects/case-studies')).body.kind).toBe('NOT_FOUND');
  });

  it('shows a draft page to an authenticated admin asking for a preview', async () => {
    const token = await createAdminAndLogin();
    await createPage({ status: 'DRAFT' });

    expect((await resolve('/projects/case-studies', token, true)).body.kind).toBe('PAGE');
  });

  it('ignores preview=true without authentication', async () => {
    await createPage({ status: 'DRAFT' });

    expect((await resolve('/projects/case-studies', undefined, true)).body.kind).toBe('NOT_FOUND');
  });

  it('hides a draft project from the public detail lookup', async () => {
    await createProject({ status: 'DRAFT' });

    expect((await resolve('/projects/payout-system')).body.kind).toBe('NOT_FOUND');
  });
});

describe('§0 section resolution', () => {
  it('returns a page with its collection sections already populated', async () => {
    await createProject({ slug: 'alpha', title: 'Alpha' });
    await createProject({ slug: 'beta', title: 'Beta' });
    await createPage({
      path: '/work',
      slug: 'work',
      sections: [{ type: 'PROJECT_LIST', layoutVariant: 'grid', order: 0 }],
    });

    const res = await resolve('/work');

    expect(res.body.kind).toBe('PAGE');
    expect(res.body.data.sections).toHaveLength(1);
    expect(res.body.data.sections[0].items).toHaveLength(2);
  });

  it('applies the section query: featuredOnly, limit and sort direction', async () => {
    await createProject({ slug: 'a', title: 'A', featured: true, order: 2 });
    await createProject({ slug: 'b', title: 'B', featured: true, order: 1 });
    await createProject({ slug: 'c', title: 'C', featured: false, order: 0 });
    await createPage({
      path: '/work',
      slug: 'work',
      sections: [
        {
          type: 'PROJECT_LIST',
          layoutVariant: 'grid',
          query: { featuredOnly: true, limit: 1, sortBy: 'order', sortDir: 'asc' },
        },
      ],
    });

    const items = (await resolve('/work')).body.data.sections[0].items;

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('B'); // featured, lowest order
  });

  it('omits hidden sections and orders the rest', async () => {
    await createPage({
      path: '/work',
      slug: 'work',
      sections: [
        { type: 'CTA_BANNER', order: 2 },
        { type: 'HERO', order: 0 },
        { type: 'RICH_CONTENT', order: 1, isVisible: false },
      ],
    });

    const sections = (await resolve('/work')).body.data.sections;

    expect(sections.map((s: { type: string }) => s.type)).toEqual(['HERO', 'CTA_BANNER']);
  });

  it('routes certification sections through the public projection', async () => {
    await createCertification();
    await createPage({
      path: '/creds',
      slug: 'creds',
      sections: [{ type: 'CERTIFICATION_LIST', layoutVariant: 'grid' }],
    });

    const [cert] = (await resolve('/creds')).body.data.sections[0].items;

    expect(cert.name).toBe('AWS SAA');
    // Admin-only fields must not leak through a page section either (§6).
    for (const field of ['status', 'showWhenExpired', 'order', 'expiresSoon']) {
      expect(cert).not.toHaveProperty(field);
    }
  });

  it('excludes expired certifications from a page section by default', async () => {
    await createCertification({
      name: 'Lapsed',
      expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    await createPage({ path: '/creds', slug: 'creds', sections: [{ type: 'CERTIFICATION_LIST' }] });

    expect((await resolve('/creds')).body.data.sections[0].items).toHaveLength(0);
  });

  it('resolves CHILD_PAGE_LIST to the published children of the page', async () => {
    const parent = await createPage({
      path: '/guides',
      slug: 'guides',
      sections: [{ type: 'CHILD_PAGE_LIST' }],
    });
    await createPage({ path: '/guides/one', slug: 'one', parentId: parent._id, depth: 1, navOrder: 0 });
    await createPage({ path: '/guides/two', slug: 'two', parentId: parent._id, depth: 1, navOrder: 1 });
    await createPage({ path: '/guides/hidden', slug: 'hidden', parentId: parent._id, depth: 1, status: 'DRAFT' });

    const items = (await resolve('/guides')).body.data.sections[0].items;

    expect(items.map((p: { path: string }) => p.path)).toEqual(['/guides/one', '/guides/two']);
  });

  it('ignores an unrecognised sortBy rather than passing it to the database', async () => {
    await createProject({ slug: 'a', title: 'A', order: 1 });
    await createProject({ slug: 'b', title: 'B', order: 0 });
    await createPage({
      path: '/work',
      slug: 'work',
      sections: [{ type: 'PROJECT_LIST', query: { sortBy: '$where', sortDir: 'asc' } }],
    });

    const items = (await resolve('/work')).body.data.sections[0].items;

    // Falls back to `order`, so B (order 0) leads.
    expect(items.map((p: { title: string }) => p.title)).toEqual(['B', 'A']);
  });

  it('drops a section whose type is no longer in the registry, keeping the rest of the page', async () => {
    await createPage({
      path: '/work',
      slug: 'work',
      sections: [
        { type: 'HERO', order: 0 },
        { type: 'REMOVED_TYPE', order: 1 },
        { type: 'CTA_BANNER', order: 2 },
      ],
    });

    const sections = (await resolve('/work')).body.data.sections;

    // Rendering a broken section is worse than omitting it; the page still loads.
    expect(sections.map((s: { type: string }) => s.type)).toEqual(['HERO', 'CTA_BANNER']);
  });

  it('never exposes unpublished collection items, even inside a previewed draft page', async () => {
    const token = await createAdminAndLogin();
    await createProject({ slug: 'live', title: 'Live', status: 'PUBLISHED' });
    await createProject({ slug: 'wip', title: 'WIP', status: 'DRAFT' });
    await createPage({
      path: '/work',
      slug: 'work',
      status: 'DRAFT',
      sections: [{ type: 'PROJECT_LIST' }],
    });

    const items = (await resolve('/work', token, true)).body.data.sections[0].items;

    // A preview shows the unpublished *page*, but must still represent what a visitor
    // would see inside it.
    expect(items.map((p: { title: string }) => p.title)).toEqual(['Live']);
  });
});

describe('§1 Page model constraints', () => {
  it('enforces a unique path', async () => {
    await createPage();
    await expect(createPage({ slug: 'other' })).rejects.toThrow();
  });

  it('rejects nesting deeper than three levels', async () => {
    await expect(createPage({ path: '/a/b/c/d', depth: 3 })).rejects.toThrow();
  });

  it('exposes id rather than _id, like every other entity', async () => {
    await createPage({ path: '/about', slug: 'about' });

    const res = await resolve('/about');

    expect(res.body.data.id).toBeTypeOf('string');
    expect(res.body.data._id).toBeUndefined();
  });
});
