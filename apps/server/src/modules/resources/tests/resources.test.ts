import { describe, it, expect } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { MainType } from '../../mainTypes/mainType.model';
import { SubType } from '../../subTypes/subType.model';
import { Resource } from '../resource.model';

async function login() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await Admin.create({ email: 'admin@portfolio.test', passwordHash, name: 'Admin' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@portfolio.test', password: 'admin123' });
  return res.body.access_token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function seedTaxonomy() {
  const infra = await MainType.create({ name: 'Infrastructure' } as never);
  const docs = await MainType.create({ name: 'Documentation' } as never);
  const hosting = await SubType.create({ name: 'Hosting', mainTypeId: infra._id } as never);
  const guides = await SubType.create({ name: 'Guides', mainTypeId: docs._id } as never);
  return { infra, docs, hosting, guides };
}

function makeResource(over: Record<string, unknown>) {
  return Resource.create({ link: 'https://example.com/a', description: 'A reference.', ...over } as never);
}

// ---------------------------------------------------------------------------
describe('Section 0.1 / 2 — the denormalized mainTypeId cannot drift', () => {
  it('rejects a create whose main type does not own the sub type', async () => {
    const token = await login();
    const { docs, hosting } = await seedTaxonomy();

    const res = await request(app)
      .post('/api/v1/admin/resources')
      .set(auth(token))
      .send({
        link: 'https://example.com/a',
        description: 'Filed under the wrong main type.',
        mainTypeId: String(docs._id),   // Documentation
        subTypeId: String(hosting._id), // ...but Hosting belongs to Infrastructure
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/does not belong to/i);
    expect(await Resource.countDocuments({})).toBe(0);
  });

  it('re-checks the pair on update, not only on create', async () => {
    const token = await login();
    const { infra, docs, hosting } = await seedTaxonomy();
    const created = await makeResource({ mainTypeId: infra._id, subTypeId: hosting._id });

    const res = await request(app)
      .patch(`/api/v1/admin/resources/${created._id}`)
      .set(auth(token))
      .send({ mainTypeId: String(docs._id) });

    expect(res.status).toBe(400);
    expect(String((await Resource.findById(created._id))!.mainTypeId)).toBe(String(infra._id));
  });

  it('rejects a sub type that does not exist', async () => {
    const token = await login();
    const { infra } = await seedTaxonomy();

    const res = await request(app)
      .post('/api/v1/admin/resources')
      .set(auth(token))
      .send({
        link: 'https://example.com/a',
        mainTypeId: String(infra._id),
        subTypeId: '6a6c8ea47b888b8a59d2374a',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/sub type does not exist/i);
  });

  it('rejects a sub type that has been soft-deleted', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();
    await SubType.updateOne({ _id: hosting._id }, { $set: { deletedAt: new Date() } });

    const res = await request(app)
      .post('/api/v1/admin/resources')
      .set(auth(token))
      .send({ link: 'https://example.com/a', mainTypeId: String(infra._id), subTypeId: String(hosting._id) });
    expect(res.status).toBe(400);
  });

  it('realigns stored resources when a sub type is moved to another main type', async () => {
    const token = await login();
    const { infra, docs, hosting } = await seedTaxonomy();
    const created = await makeResource({ mainTypeId: infra._id, subTypeId: hosting._id });

    const res = await request(app)
      .patch(`/api/v1/admin/sub-types/${hosting._id}`)
      .set(auth(token))
      .send({ mainTypeId: String(docs._id) });
    expect(res.status).toBe(200);

    // Without this the resource would still claim Infrastructure while its sub type had
    // moved — the exact drift the denormalization risks.
    expect(String((await Resource.findById(created._id))!.mainTypeId)).toBe(String(docs._id));
  });
});

// ---------------------------------------------------------------------------
describe('Section 1 — uniqueness excludes soft-deleted rows and is case-insensitive', () => {
  it('lets a main type name be reused after the original is deleted', async () => {
    const token = await login();
    const created = await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'Jobs' });
    expect(created.status).toBe(201);

    await request(app).delete(`/api/v1/admin/main-types/${created.body.id}`).set(auth(token));

    // A plain unique index would reserve the name forever, because the soft-deleted row
    // still exists and the index still enforces against it.
    const again = await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'Jobs' });
    expect(again.status).toBe(201);
  });

  it('treats "Jobs" and "jobs" as the same live name', async () => {
    const token = await login();
    await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'Jobs' });

    const dup = await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'jobs' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toMatch(/already exists/i);
  });

  it('does not let a rename collide with another live name', async () => {
    const token = await login();
    await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'Jobs' });
    const other = await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'Tools' });

    const res = await request(app)
      .patch(`/api/v1/admin/main-types/${other.body.id}`)
      .set(auth(token))
      .send({ name: 'JOBS' });
    expect(res.status).toBe(409);
  });

  it('lets a main type keep its own name on an unrelated edit', async () => {
    const token = await login();
    const created = await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'Jobs' });

    const res = await request(app)
      .patch(`/api/v1/admin/main-types/${created.body.id}`)
      .set(auth(token))
      .send({ name: 'Jobs', description: 'Updated.' });
    expect(res.status).toBe(200);
  });

  it('scopes sub type names to their main type', async () => {
    const token = await login();
    const { infra, docs } = await seedTaxonomy();

    // "Hosting" already exists under Infrastructure; under Documentation it is a
    // different thing and must be allowed.
    const ok = await request(app)
      .post('/api/v1/admin/sub-types')
      .set(auth(token))
      .send({ name: 'Hosting', mainTypeId: String(docs._id) });
    expect(ok.status).toBe(201);

    const dup = await request(app)
      .post('/api/v1/admin/sub-types')
      .set(auth(token))
      .send({ name: 'hosting', mainTypeId: String(infra._id) });
    expect(dup.status).toBe(409);
  });

  it('allows the same link under a different main type + sub type pair', async () => {
    const token = await login();
    const { infra, docs, hosting, guides } = await seedTaxonomy();

    const first = await request(app).post('/api/v1/admin/resources').set(auth(token)).send({
      link: 'https://example.com/shared', mainTypeId: String(infra._id), subTypeId: String(hosting._id),
    });
    expect(first.status).toBe(201);

    // One page can legitimately be both an infrastructure and a documentation reference.
    const second = await request(app).post('/api/v1/admin/resources').set(auth(token)).send({
      link: 'https://example.com/shared', mainTypeId: String(docs._id), subTypeId: String(guides._id),
    });
    expect(second.status).toBe(201);

    const dup = await request(app).post('/api/v1/admin/resources').set(auth(token)).send({
      link: 'https://example.com/shared', mainTypeId: String(infra._id), subTypeId: String(hosting._id),
    });
    expect(dup.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
describe('Section 2 — only ACTIVE, non-deleted types are selectable', () => {
  it('omits INACTIVE and deleted main types from the options endpoint', async () => {
    const token = await login();
    await MainType.create({ name: 'Live' } as never);
    await MainType.create({ name: 'Paused', status: 'INACTIVE' } as never);
    await MainType.create({ name: 'Removed', deletedAt: new Date() } as never);

    const options = (await request(app).get('/api/v1/admin/main-types/options').set(auth(token))).body;
    expect(options.map((o: { name: string }) => o.name)).toEqual(['Live']);

    // The management list still shows INACTIVE, or it could never be reactivated.
    const all = (await request(app).get('/api/v1/admin/main-types').set(auth(token))).body;
    expect(all.items.map((o: { name: string }) => o.name).sort()).toEqual(['Live', 'Paused']);
  });

  it('omits INACTIVE and deleted sub types, and requires a parent', async () => {
    const token = await login();
    const { infra } = await seedTaxonomy();
    await SubType.create({ name: 'Paused', mainTypeId: infra._id, status: 'INACTIVE' } as never);

    const options = (await request(app)
      .get(`/api/v1/admin/sub-types/options?mainTypeId=${infra._id}`)
      .set(auth(token))).body;
    expect(options.map((o: { name: string }) => o.name)).toEqual(['Hosting']);

    // A dependent dropdown with no parent chosen should show nothing, not everything.
    const noParent = await request(app).get('/api/v1/admin/sub-types/options').set(auth(token));
    expect(noParent.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('Section 2 — cascade delete', () => {
  it('blocks deleting a main type that still has children, naming the counts', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();
    await makeResource({ mainTypeId: infra._id, subTypeId: hosting._id });

    const res = await request(app).delete(`/api/v1/admin/main-types/${infra._id}`).set(auth(token));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CASCADE_REQUIRED');
    expect(res.body.error.message).toMatch(/1 sub type and 1 resource reference this main type/i);
    expect(res.body.error.details.subTypes).toBe(1);
    expect(res.body.error.details.resources).toBe(1);
    // Nothing may have been removed by a blocked delete.
    expect(await MainType.countDocuments({ deletedAt: null })).toBe(2);
  });

  it('cascades the whole subtree when asked, stamping one shared deletedAt', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();
    const resource = await makeResource({ mainTypeId: infra._id, subTypeId: hosting._id });

    const res = await request(app)
      .delete(`/api/v1/admin/main-types/${infra._id}?cascade=true`)
      .set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.cascaded).toEqual({ subTypes: 1, resources: 1 });

    const [main, sub, deletedResource] = await Promise.all([
      MainType.findById(infra._id),
      SubType.findById(hosting._id),
      Resource.findById(resource._id),
    ]);

    // One timestamp across the set, so a later restore can identify what went down
    // together — that is the whole reason for sharing the instant rather than calling
    // new Date() per collection.
    expect(main!.deletedAt).toBeTruthy();
    expect(sub!.deletedAt!.getTime()).toBe(main!.deletedAt!.getTime());
    expect(deletedResource!.deletedAt!.getTime()).toBe(main!.deletedAt!.getTime());
  });

  it('leaves an unrelated main type untouched when cascading', async () => {
    const token = await login();
    const { infra, docs, guides } = await seedTaxonomy();

    await request(app).delete(`/api/v1/admin/main-types/${infra._id}?cascade=true`).set(auth(token));

    expect((await MainType.findById(docs._id))!.deletedAt).toBeNull();
    expect((await SubType.findById(guides._id))!.deletedAt).toBeNull();
  });

  it('blocks deleting a sub type that still has resources, and cascades on request', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();
    const resource = await makeResource({ mainTypeId: infra._id, subTypeId: hosting._id });

    const blocked = await request(app).delete(`/api/v1/admin/sub-types/${hosting._id}`).set(auth(token));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/1 resource reference/i);

    const cascaded = await request(app)
      .delete(`/api/v1/admin/sub-types/${hosting._id}?cascade=true`)
      .set(auth(token));
    expect(cascaded.status).toBe(200);
    expect((await Resource.findById(resource._id))!.deletedAt).toBeTruthy();
  });

  it('deletes a childless main type without needing cascade', async () => {
    const token = await login();
    const created = await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'Empty' });

    const res = await request(app).delete(`/api/v1/admin/main-types/${created.body.id}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.cascaded).toEqual({ subTypes: 0, resources: 0 });
  });
});

// ---------------------------------------------------------------------------
describe('Section 2 — restore', () => {
  it('refuses to restore a sub type while its main type is still deleted', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();
    await request(app).delete(`/api/v1/admin/main-types/${infra._id}?cascade=true`).set(auth(token));

    const res = await request(app).post(`/api/v1/admin/sub-types/${hosting._id}/restore`).set(auth(token));

    // A child restored under a deleted parent is live but unreachable: every dropdown
    // filters by its parent, so it would simply never appear.
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/restore the main type first/i);
    expect((await SubType.findById(hosting._id))!.deletedAt).toBeTruthy();
  });

  it('restores parent then child, in that order', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();
    await request(app).delete(`/api/v1/admin/main-types/${infra._id}?cascade=true`).set(auth(token));

    expect((await request(app).post(`/api/v1/admin/main-types/${infra._id}/restore`).set(auth(token))).status).toBe(200);
    expect((await request(app).post(`/api/v1/admin/sub-types/${hosting._id}/restore`).set(auth(token))).status).toBe(200);
    expect((await SubType.findById(hosting._id))!.deletedAt).toBeNull();
  });

  it('refuses to restore a resource whose sub type is still deleted', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();
    const resource = await makeResource({ mainTypeId: infra._id, subTypeId: hosting._id });
    await request(app).delete(`/api/v1/admin/sub-types/${hosting._id}?cascade=true`).set(auth(token));

    const res = await request(app).post(`/api/v1/admin/resources/${resource._id}/restore`).set(auth(token));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/restore the sub type first/i);
  });

  it('refuses to restore a main type whose name was taken while it was gone', async () => {
    const token = await login();
    const created = await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'Jobs' });
    await request(app).delete(`/api/v1/admin/main-types/${created.body.id}`).set(auth(token));
    await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'Jobs' });

    const res = await request(app).post(`/api/v1/admin/main-types/${created.body.id}/restore`).set(auth(token));
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
describe('Section 0.3 / 3.1 — listing searches the joined type names', () => {
  async function seedResources() {
    const { infra, docs, hosting, guides } = await seedTaxonomy();
    await makeResource({ link: 'https://fly.io/docs', description: 'Deployment platform.', mainTypeId: infra._id, subTypeId: hosting._id });
    await makeResource({ link: 'https://example.com/style', description: 'Writing style guide.', mainTypeId: docs._id, subTypeId: guides._id });
    return { infra, docs, hosting, guides };
  }

  const list = (token: string, qs = '') =>
    request(app).get(`/api/v1/admin/resources${qs}`).set(auth(token));

  it('matches on a main type name, which lives in another collection entirely', async () => {
    const token = await login();
    await seedResources();

    // Neither resource has "Infrastructure" in its own fields — a plain find() could
    // never return this, which is why the listing is an aggregation.
    const res = await list(token, '?search=Infrastructure');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].link).toBe('https://fly.io/docs');
  });

  it('matches on a sub type name', async () => {
    const token = await login();
    await seedResources();
    const res = await list(token, '?search=Guides');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].link).toBe('https://example.com/style');
  });

  it('still matches on the resource’s own link and description', async () => {
    const token = await login();
    await seedResources();

    expect((await list(token, '?search=fly.io')).body.items).toHaveLength(1);
    expect((await list(token, '?search=Writing')).body.items).toHaveLength(1);

    // The search is a literal substring, not a set of independent words: "style guide"
    // matches "Writing style guide", "guide style" matches nothing.
    expect((await list(token, '?search=style%20guide')).body.items).toHaveLength(1);
    expect((await list(token, '?search=guide%20style')).body.items).toHaveLength(0);
  });

  it('treats a regex metacharacter in the search as literal text', async () => {
    const token = await login();
    await seedResources();

    // An unescaped "(" would throw and 500 the endpoint; ".*" would match everything.
    expect((await list(token, '?search=%28')).status).toBe(200);
    expect((await list(token, '?search=%28')).body.items).toHaveLength(0);
    expect((await list(token, '?search=.*')).body.items).toHaveLength(0);
  });

  it('flattens the joined names so the table does not need a second request', async () => {
    const token = await login();
    await seedResources();

    const row = (await list(token)).body.items.find((r: { link: string }) => r.link === 'https://fly.io/docs');
    expect(row.mainTypeName).toBe('Infrastructure');
    expect(row.subTypeName).toBe('Hosting');
    expect(row.id).toMatch(/^[a-f0-9]{24}$/);
  });

  it('keeps a resource visible when its parent row has been hard-deleted', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();
    await makeResource({ mainTypeId: infra._id, subTypeId: hosting._id });
    await MainType.collection.deleteOne({ _id: infra._id });

    // preserveNullAndEmptyArrays: vanishing silently is worse than a blank category,
    // because there is no way to notice the bookmark is gone.
    const res = await list(token);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].mainTypeName).toBeUndefined();
  });

  it('filters by main type, status and date range', async () => {
    const token = await login();
    const { infra, hosting } = await seedResources();
    await makeResource({ link: 'https://example.com/off', mainTypeId: infra._id, subTypeId: hosting._id, status: 'INACTIVE' });

    expect((await list(token, `?mainTypeId=${infra._id}`)).body.total).toBe(2);
    expect((await list(token, '?status=INACTIVE')).body.total).toBe(1);

    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    expect((await list(token, `?createdFrom=${tomorrow}`)).body.total).toBe(0);
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect((await list(token, `?createdFrom=${yesterday}`)).body.total).toBe(3);
  });
});

// ---------------------------------------------------------------------------
describe('Section 3 — list conventions', () => {
  async function seedMany(count: number) {
    const { infra, hosting } = await seedTaxonomy();
    for (let i = 0; i < count; i++) {
      await makeResource({ link: `https://example.com/${i}`, mainTypeId: infra._id, subTypeId: hosting._id });
    }
    return { infra, hosting };
  }

  it('returns the { items, total, page, limit, totalPages } envelope', async () => {
    const token = await login();
    await seedMany(3);

    const res = await request(app).get('/api/v1/admin/resources?page=1&limit=2').set(auth(token));
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
    expect(res.body.totalPages).toBe(2);
  });

  it('reports pagination metadata against the filtered set, not the whole collection', async () => {
    const token = await login();
    const { infra, hosting } = await seedMany(3);
    await makeResource({ link: 'https://example.com/x', mainTypeId: infra._id, subTypeId: hosting._id, status: 'INACTIVE' });

    const res = await request(app).get('/api/v1/admin/resources?status=INACTIVE&limit=2').set(auth(token));
    expect(res.body.total).toBe(1);
    expect(res.body.totalPages).toBe(1);
  });

  it('caps limit so a client cannot request the entire collection', async () => {
    const token = await login();
    await seedMany(1);
    const res = await request(app).get('/api/v1/admin/resources?limit=100000').set(auth(token));
    expect(res.body.limit).toBe(100);
  });

  it('falls back to the default sort when sortBy is not on the allowlist', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();

    // Descriptions are ordered opposite to creation order, so honouring the unlisted
    // `description` key produces a visibly different sequence from the `createdAt`
    // fallback. Asserting only a 200 would prove nothing: MongoDB sorts by a field that
    // does not exist without complaining, so a bypassed allowlist looks identical to a
    // working one unless the ordering itself is checked.
    const links = ['https://z.example', 'https://y.example', 'https://x.example'];
    const descriptions = ['c', 'b', 'a'];
    for (let i = 0; i < links.length; i++) {
      await makeResource({ link: links[i], description: descriptions[i], mainTypeId: infra._id, subTypeId: hosting._id });
    }

    const listed = await request(app)
      .get('/api/v1/admin/resources?sortBy=description&sortDir=asc')
      .set(auth(token));

    expect(listed.status).toBe(200);
    // createdAt ascending — i.e. the order they were made, not description order.
    expect(listed.body.items.map((r: { link: string }) => r.link)).toEqual(links);
  });

  it('sorts by a joined name, which only exists inside the pipeline', async () => {
    const token = await login();
    const { infra, docs, hosting, guides } = await seedTaxonomy();
    await makeResource({ link: 'https://a.example', mainTypeId: infra._id, subTypeId: hosting._id });
    await makeResource({ link: 'https://b.example', mainTypeId: docs._id, subTypeId: guides._id });

    const asc = await request(app)
      .get('/api/v1/admin/resources?sortBy=mainTypeName&sortDir=asc')
      .set(auth(token));
    const names = asc.body.items.map((r: { mainTypeName: string }) => r.mainTypeName);
    expect(names).toEqual(['Documentation', 'Infrastructure']);
  });

  it('excludes soft-deleted records by default and includes them on request', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();
    const created = await makeResource({ mainTypeId: infra._id, subTypeId: hosting._id });
    await request(app).delete(`/api/v1/admin/resources/${created._id}`).set(auth(token));

    expect((await request(app).get('/api/v1/admin/resources').set(auth(token))).body.total).toBe(0);

    const withDeleted = await request(app).get('/api/v1/admin/resources?includeDeleted=true').set(auth(token));
    expect(withDeleted.body.total).toBe(1);
    expect(withDeleted.body.items[0].deletedAt).toBeTruthy();
  });

  it('paginates main types and sub types with the same envelope', async () => {
    const token = await login();
    await seedTaxonomy();

    const mains = await request(app).get('/api/v1/admin/main-types').set(auth(token));
    expect(mains.body.total).toBe(2);
    expect(mains.body.items.every((m: { subTypeCount: number }) => m.subTypeCount === 1)).toBe(true);

    const subs = await request(app).get('/api/v1/admin/sub-types').set(auth(token));
    expect(subs.body.total).toBe(2);
    expect(subs.body.items[0].mainTypeName).toBeTruthy();
    expect(subs.body.items[0].resourceCount).toBe(0);
  });

  it('serves a single record by id, and 404s on a bad or unknown one', async () => {
    const token = await login();
    const { infra } = await seedTaxonomy();

    expect((await request(app).get(`/api/v1/admin/main-types/${infra._id}`).set(auth(token))).body.name)
      .toBe('Infrastructure');
    expect((await request(app).get('/api/v1/admin/main-types/6a6c8ea47b888b8a59d2374a').set(auth(token))).status)
      .toBe(404);
    expect((await request(app).get('/api/v1/admin/main-types/not-an-id').set(auth(token))).status).toBe(404);
  });

  it('toggles a resource status through its dedicated endpoint', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();
    const created = await makeResource({ mainTypeId: infra._id, subTypeId: hosting._id });

    const res = await request(app)
      .patch(`/api/v1/admin/resources/${created._id}/status`)
      .set(auth(token))
      .send({ status: 'INACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INACTIVE');

    const bad = await request(app)
      .patch(`/api/v1/admin/resources/${created._id}/status`)
      .set(auth(token))
      .send({ status: 'ARCHIVED' });
    expect(bad.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('Section 3.2 — link validation is a security boundary', () => {
  it('rejects a javascript: URL', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();

    // The link is rendered as an anchor href, so a permissive URL check is an XSS vector.
    // z.string().url() accepts this happily, which is why the scheme is allowlisted.
    const res = await request(app).post('/api/v1/admin/resources').set(auth(token)).send({
      link: 'javascript:alert(1)',
      mainTypeId: String(infra._id),
      subTypeId: String(hosting._id),
    });
    expect(res.status).toBe(400);
    expect(await Resource.countDocuments({})).toBe(0);
  });

  it('rejects data: and other non-http schemes', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();

    for (const link of ['data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'ftp://example.com/x']) {
      const res = await request(app)
        .post('/api/v1/admin/resources')
        .set(auth(token))
        .send({ link, mainTypeId: String(infra._id), subTypeId: String(hosting._id) });
      expect(res.status).toBe(400);
    }
    expect(await Resource.countDocuments({})).toBe(0);
  });

  it('strips a trailing slash so /jobs and /jobs/ are the same bookmark', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();
    const payload = { mainTypeId: String(infra._id), subTypeId: String(hosting._id) };

    const first = await request(app).post('/api/v1/admin/resources').set(auth(token))
      .send({ ...payload, link: 'https://example.com/jobs' });
    expect(first.status).toBe(201);
    expect(first.body.link).toBe('https://example.com/jobs');

    // Without normalization the duplicate index would treat this as a different resource
    // and the guard would silently do nothing.
    const second = await request(app).post('/api/v1/admin/resources').set(auth(token))
      .send({ ...payload, link: 'https://example.com/jobs/' });
    expect(second.status).toBe(409);
  });

  it('does not mangle a bare origin', async () => {
    const token = await login();
    const { infra, hosting } = await seedTaxonomy();

    const res = await request(app).post('/api/v1/admin/resources').set(auth(token)).send({
      link: 'https://example.com/', mainTypeId: String(infra._id), subTypeId: String(hosting._id),
    });
    expect(res.status).toBe(201);
    expect(res.body.link).toBe('https://example.com');
  });

  it('rejects a name longer than 100 characters', async () => {
    const token = await login();
    const res = await request(app).post('/api/v1/admin/main-types').set(auth(token))
      .send({ name: 'x'.repeat(101) });
    expect(res.status).toBe(400);
  });

  it('translates a duplicate-key error into a readable message, never a raw driver error', async () => {
    const token = await login();
    await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'Jobs' });
    const dup = await request(app).post('/api/v1/admin/main-types').set(auth(token)).send({ name: 'Jobs' });

    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toMatch(/already exists/i);
    expect(JSON.stringify(dup.body)).not.toMatch(/E11000|dup key|MongoServerError/i);
  });
});
