import { describe, it, expect } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { Skill } from '../../skills/skill.model';
import { Certification } from '../certification.model';

async function createAdminAndLogin() {
  const email = 'admin@portfolio.test';
  const password = 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);
  await Admin.create({ email, passwordHash, name: 'Admin' });

  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  return login.body.access_token as string;
}

const DAY = 24 * 60 * 60 * 1000;

function certDoc(overrides: Record<string, unknown> = {}) {
  return {
    name: 'AWS Certified Solutions Architect',
    issuingOrganization: 'Amazon Web Services',
    issueDate: new Date('2025-03-14'),
    ...overrides,
  };
}

function certPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'AWS Certified Solutions Architect',
    issuingOrganization: 'Amazon Web Services',
    issueDate: '2025-03-14',
    ...overrides,
  };
}

describe('Public certifications API', () => {
  it('hides drafts', async () => {
    await Certification.create(certDoc({ status: 'PUBLISHED' }));
    await Certification.create(certDoc({ name: 'Draft Cert', status: 'DRAFT' }));

    const res = await request(app).get('/api/v1/certifications');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    // `status` itself is projected out of public payloads (§6), so assert on identity.
    expect(res.body[0].name).toBe('AWS Certified Solutions Architect');
  });

  it('hides expired credentials by default', async () => {
    await Certification.create(certDoc({ name: 'Current', expiryDate: new Date(Date.now() + 365 * DAY) }));
    await Certification.create(certDoc({ name: 'Lapsed', expiryDate: new Date(Date.now() - DAY) }));

    const res = await request(app).get('/api/v1/certifications');

    expect(res.body.map((c: { name: string }) => c.name)).toEqual(['Current']);
  });

  it('includes expired credentials when explicitly requested', async () => {
    await Certification.create(certDoc({ name: 'Lapsed', expiryDate: new Date(Date.now() - DAY) }));

    const res = await request(app).get('/api/v1/certifications?includeExpired=true');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].isExpired).toBe(true);
  });

  it('keeps an expired credential visible when showWhenExpired is set', async () => {
    await Certification.create(certDoc({ name: 'Lapsed but shown', expiryDate: new Date(Date.now() - DAY), showWhenExpired: true }));

    const res = await request(app).get('/api/v1/certifications');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].isExpired).toBe(true);
  });

  it('treats never-expiring credentials as current', async () => {
    await Certification.create(certDoc({ neverExpires: true }));

    const res = await request(app).get('/api/v1/certifications');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].isExpired).toBe(false);
  });

  it('withholds the expiring-soon signal from the public, per §4.2', async () => {
    const token = await createAdminAndLogin();
    await Certification.create(certDoc({ expiryDate: new Date(Date.now() + 30 * DAY) }));

    const publicRes = await request(app).get('/api/v1/certifications');
    expect(publicRes.body[0].isExpired).toBe(false);
    expect(publicRes.body[0]).not.toHaveProperty('expiresSoon');

    // It exists purely to drive the admin renewal dashboard.
    const adminRes = await request(app).get('/api/v1/admin/certifications').set('Authorization', `Bearer ${token}`);
    expect(adminRes.body[0].expiresSoon).toBe(true);
  });

  it('exposes id rather than _id', async () => {
    await Certification.create(certDoc());

    const res = await request(app).get('/api/v1/certifications');

    expect(res.body[0].id).toBeTypeOf('string');
    expect(res.body[0]._id).toBeUndefined();
  });

  it('filters by domain and by the skill a credential validates', async () => {
    const skill = await Skill.create({ name: 'Docker', category: 'Tools' });
    const other = await Skill.create({ name: 'Python', category: 'ML/AI' });
    await Certification.create(certDoc({ skillIds: [skill._id], domains: ['SOFTWARE_DEVELOPMENT'] }));
    await Certification.create(certDoc({ name: 'TF Cert', skillIds: [other._id], domains: ['AI_ENGINEERING'] }));

    const bySkill = await request(app).get(`/api/v1/certifications?skillId=${skill.id}`);
    expect(bySkill.body).toHaveLength(1);
    expect(bySkill.body[0].name).toBe('AWS Certified Solutions Architect');

    const byDomain = await request(app).get('/api/v1/certifications?domain=AI_ENGINEERING');
    expect(byDomain.body).toHaveLength(1);
    expect(byDomain.body[0].name).toBe('TF Cert');
  });

  it('paginates when page/limit are given', async () => {
    for (const name of ['A', 'B', 'C']) await Certification.create(certDoc({ name }));

    const res = await request(app).get('/api/v1/certifications?page=1&limit=2');

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });

  it('404s a draft on the detail route', async () => {
    const draft = await Certification.create(certDoc({ status: 'DRAFT' }));

    const res = await request(app).get(`/api/v1/certifications/${draft.id}`);
    expect(res.status).toBe(404);
  });
});

describe('Admin certifications API', () => {
  it('requires auth on every admin route', async () => {
    expect((await request(app).get('/api/v1/admin/certifications')).status).toBe(401);
    expect((await request(app).post('/api/v1/admin/certifications').send(certPayload())).status).toBe(401);
    expect((await request(app).patch('/api/v1/admin/certifications/reorder').send({ ids: [] })).status).toBe(401);
  });

  it('returns drafts and expired credentials, unlike the public list', async () => {
    const token = await createAdminAndLogin();
    await Certification.create(certDoc({ name: 'Draft', status: 'DRAFT' }));
    await Certification.create(certDoc({ name: 'Lapsed', expiryDate: new Date(Date.now() - DAY) }));

    const res = await request(app).get('/api/v1/admin/certifications').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('creates a certification with a valid payload', async () => {
    const token = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/v1/admin/certifications')
      .set('Authorization', `Bearer ${token}`)
      .send(certPayload());

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('AWS Certified Solutions Architect');
  });

  it('rejects free-text skill names — the mapping must be real Skill ids', async () => {
    const token = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/v1/admin/certifications')
      .set('Authorization', `Bearer ${token}`)
      .send(certPayload({ skillIds: ['Node.js'], description: 'Covers building distributed backend services.' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a well-formed id that does not match any Skill, rather than storing a dangling ref', async () => {
    const token = await createAdminAndLogin();
    const ghostId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .post('/api/v1/admin/certifications')
      .set('Authorization', `Bearer ${token}`)
      .send(certPayload({ skillIds: [ghostId], description: 'Covers building distributed backend services.' }));

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/do not exist/i);
    expect(res.body.error.details.skillIds).toEqual([ghostId]);
  });

  it('rejects a skill mapping with no description of what the credential covers', async () => {
    const token = await createAdminAndLogin();
    const skill = await Skill.create({ name: 'Docker', category: 'Tools' });

    const res = await request(app)
      .post('/api/v1/admin/certifications')
      .set('Authorization', `Bearer ${token}`)
      .send(certPayload({ skillIds: [skill.id] }));

    expect(res.status).toBe(400);
  });

  it('bulk-reorders by array position', async () => {
    const token = await createAdminAndLogin();
    const a = await Certification.create(certDoc({ name: 'A', order: 0 }));
    const b = await Certification.create(certDoc({ name: 'B', order: 1 }));
    const c = await Certification.create(certDoc({ name: 'C', order: 2 }));

    const res = await request(app)
      .patch('/api/v1/admin/certifications/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [c.id, a.id, b.id] });

    expect(res.status).toBe(200);
    expect(res.body.modified).toBe(3);

    const listed = await request(app).get('/api/v1/certifications');
    expect(listed.body.map((cert: { name: string }) => cert.name)).toEqual(['C', 'A', 'B']);
  });

  it('does not mistake "reorder" for a certification id', async () => {
    const token = await createAdminAndLogin();

    const res = await request(app)
      .patch('/api/v1/admin/certifications/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [] });

    // Fails schema validation (min 1), not a cast error on the :id route.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('deletes a certification', async () => {
    const token = await createAdminAndLogin();
    const cert = await Certification.create(certDoc());

    const res = await request(app).delete(`/api/v1/admin/certifications/${cert.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(await Certification.findById(cert.id)).toBeNull();
  });
});

// Each of these pins one line of the §6 guardrail list, so a regression shows up as a
// named failure rather than as a subtle behaviour change.
describe('§6 guardrails', () => {
  const ADMIN_ONLY_FIELDS = ['status', 'showWhenExpired', 'order', 'expiresSoon', 'createdAt', 'updatedAt'];

  it('never leaks admin-only fields on the public list', async () => {
    await Certification.create(certDoc({ status: 'PUBLISHED', showWhenExpired: true, order: 3, featured: true }));

    const res = await request(app).get('/api/v1/certifications');

    for (const field of ADMIN_ONLY_FIELDS) {
      expect(res.body[0]).not.toHaveProperty(field);
    }
  });

  it('never leaks admin-only fields on the public detail route', async () => {
    const cert = await Certification.create(certDoc());

    const res = await request(app).get(`/api/v1/certifications/${cert.id}`);

    expect(res.status).toBe(200);
    for (const field of ADMIN_ONLY_FIELDS) {
      expect(res.body).not.toHaveProperty(field);
    }
  });

  it('never leaks admin-only fields through the paginated public list', async () => {
    await Certification.create(certDoc());

    const res = await request(app).get('/api/v1/certifications?page=1&limit=10');

    for (const field of ADMIN_ONLY_FIELDS) {
      expect(res.body.data[0]).not.toHaveProperty(field);
    }
  });

  it('still returns every field the public site actually renders', async () => {
    const skill = await Skill.create({ name: 'Docker', category: 'Tools' });
    await Certification.create(
      certDoc({
        skillIds: [skill._id],
        issuerLogoUrl: 'https://example.com/logo.png',
        credentialId: 'ABC-123',
        credentialUrl: 'https://example.com/verify',
        certificateImageUrl: 'https://example.com/cert.png',
        description: 'Covers designing distributed systems.',
        domains: ['SOFTWARE_DEVELOPMENT'],
        expiryDate: new Date(Date.now() + 365 * DAY),
      })
    );

    const [body] = (await request(app).get('/api/v1/certifications')).body;

    for (const field of [
      'id', 'name', 'issuingOrganization', 'issuerLogoUrl', 'issueDate', 'expiryDate',
      'neverExpires', 'isExpired', 'credentialId', 'credentialUrl', 'certificateImageUrl',
      'description', 'skillIds', 'domains',
    ]) {
      expect(body).toHaveProperty(field);
    }
    expect(body.skillIds).toEqual([String(skill._id)]);
  });

  it('keeps admin-only fields available on the admin list', async () => {
    const token = await createAdminAndLogin();
    await Certification.create(certDoc({ showWhenExpired: true, order: 7 }));

    const res = await request(app).get('/api/v1/admin/certifications').set('Authorization', `Bearer ${token}`);

    // The projection is public-only; admin still sees the whole record.
    for (const field of ADMIN_ONLY_FIELDS) {
      expect(res.body[0]).toHaveProperty(field);
    }
  });

  it('computes isExpired on the aggregation path, where Mongoose virtuals do not run', async () => {
    const skill = await Skill.create({ name: 'Docker', category: 'Tools' });
    await Certification.create(
      certDoc({ skillIds: [skill._id], expiryDate: new Date(Date.now() - DAY), showWhenExpired: true })
    );

    const res = await request(app).get('/api/v1/skills?withCertifications=true');

    expect(res.body[0].certifications[0]).toHaveProperty('isExpired', true);
  });

  it('rejects any skillIds entry that does not resolve to a real Skill', async () => {
    const token = await createAdminAndLogin();
    const real = await Skill.create({ name: 'Docker', category: 'Tools' });

    const res = await request(app)
      .post('/api/v1/admin/certifications')
      .set('Authorization', `Bearer ${token}`)
      .send(
        certPayload({
          skillIds: [real.id, '507f1f77bcf86cd799439011'],
          description: 'Covers designing distributed systems on AWS.',
        })
      );

    expect(res.status).toBe(400);
    // Names only the offending id, not the whole list.
    expect(res.body.error.details.skillIds).toEqual(['507f1f77bcf86cd799439011']);
  });
});

describe('Skill deletion cascade (§2.1)', () => {
  // The multi-certification version of this lives in the §7 block below.
  it('leaves certifications that never referenced the skill untouched', async () => {
    const token = await createAdminAndLogin();
    const docker = await Skill.create({ name: 'Docker', category: 'Tools' });
    const python = await Skill.create({ name: 'Python', category: 'ML/AI' });
    const cert = await Certification.create(certDoc({ skillIds: [python._id] }));

    await request(app).delete(`/api/v1/skills/${docker.id}`).set('Authorization', `Bearer ${token}`);

    const after = await Certification.findById(cert.id);
    expect(after!.skillIds.map(String)).toEqual([String(python._id)]);
  });

  it('reports the referencing certifications so the admin can be warned before deleting', async () => {
    const token = await createAdminAndLogin();
    const docker = await Skill.create({ name: 'Docker', category: 'Tools' });
    await Certification.create(certDoc({ name: 'AWS SAA', skillIds: [docker._id] }));
    await Certification.create(certDoc({ name: 'CKA', skillIds: [docker._id], status: 'DRAFT' }));

    const res = await request(app)
      .get(`/api/v1/admin/skills/${docker.id}/certifications`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Drafts count too — this is the true reference count, not the public one.
    expect(res.body).toHaveLength(2);
  });

  it('cascades through deleteOne, not just findOneAndDelete', async () => {
    const docker = await Skill.create({ name: 'Docker', category: 'Tools' });
    const cert = await Certification.create(certDoc({ skillIds: [docker._id] }));

    await Skill.deleteOne({ _id: docker._id });

    expect((await Certification.findById(cert.id))!.skillIds).toHaveLength(0);
  });

  it('cascades through deleteMany across every removed skill', async () => {
    const docker = await Skill.create({ name: 'Docker', category: 'Tools' });
    const node = await Skill.create({ name: 'Node.js', category: 'Backend' });
    const kept = await Skill.create({ name: 'Python', category: 'ML/AI' });
    const cert = await Certification.create({ ...certDoc(), skillIds: [docker._id, node._id, kept._id] });

    await Skill.deleteMany({ name: { $in: ['Docker', 'Node.js'] } });

    const after = await Certification.findById(cert.id);
    expect(after!.skillIds.map(String)).toEqual([String(kept._id)]);
  });

  it('404s the reference lookup for a skill that does not exist', async () => {
    const token = await createAdminAndLogin();

    const res = await request(app)
      .get('/api/v1/admin/skills/507f1f77bcf86cd799439011/certifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('Skill → Certification reverse lookup (§2.2)', () => {
  it('omits certifications unless withCertifications=true', async () => {
    const skill = await Skill.create({ name: 'Docker', category: 'Tools' });
    await Certification.create(certDoc({ skillIds: [skill._id] }));

    const plain = await request(app).get('/api/v1/skills');
    expect(plain.body[0].certifications).toBeUndefined();

    const joined = await request(app).get('/api/v1/skills?withCertifications=true');
    expect(joined.body[0].certifications).toHaveLength(1);
  });

  it('maps id and isExpired despite aggregation bypassing Mongoose virtuals', async () => {
    const skill = await Skill.create({ name: 'Docker', category: 'Tools' });
    await Certification.create(certDoc({ skillIds: [skill._id], credentialUrl: 'https://example.com/verify' }));

    const res = await request(app).get('/api/v1/skills?withCertifications=true');

    expect(res.body[0].id).toBeTypeOf('string');
    expect(res.body[0]._id).toBeUndefined();

    const cert = res.body[0].certifications[0];
    expect(cert.id).toBeTypeOf('string');
    expect(cert._id).toBeUndefined();
    expect(cert.isExpired).toBe(false);
    expect(cert.credentialUrl).toBe('https://example.com/verify');
  });

  it('excludes drafts from the badge lookup', async () => {
    const skill = await Skill.create({ name: 'Docker', category: 'Tools' });
    await Certification.create(certDoc({ skillIds: [skill._id], status: 'DRAFT' }));

    const res = await request(app).get('/api/v1/skills?withCertifications=true');

    expect(res.body[0].certifications).toEqual([]);
  });

  it('excludes expired credentials, so a lapsed badge cannot over-claim', async () => {
    const skill = await Skill.create({ name: 'Docker', category: 'Tools' });
    await Certification.create(certDoc({ skillIds: [skill._id], expiryDate: new Date(Date.now() - DAY) }));

    const res = await request(app).get('/api/v1/skills?withCertifications=true');

    expect(res.body[0].certifications).toEqual([]);
  });

  it('keeps a lapsed credential on the badge when showWhenExpired is set, flagged as expired', async () => {
    const skill = await Skill.create({ name: 'Docker', category: 'Tools' });
    await Certification.create(
      certDoc({ skillIds: [skill._id], expiryDate: new Date(Date.now() - DAY), showWhenExpired: true })
    );

    const res = await request(app).get('/api/v1/skills?withCertifications=true');

    expect(res.body[0].certifications).toHaveLength(1);
    expect(res.body[0].certifications[0].isExpired).toBe(true);
  });

  it('maps one certification onto every skill it validates in a single pass', async () => {
    const docker = await Skill.create({ name: 'Docker', category: 'Tools', order: 1 });
    const node = await Skill.create({ name: 'Node.js', category: 'Backend', order: 2 });
    await Certification.create(certDoc({ skillIds: [docker._id, node._id] }));

    const res = await request(app).get('/api/v1/skills?withCertifications=true');

    expect(res.body).toHaveLength(2);
    expect(res.body[0].certifications).toHaveLength(1);
    expect(res.body[1].certifications).toHaveLength(1);
  });

  it('still joins when the skills list is paginated', async () => {
    const skill = await Skill.create({ name: 'Docker', category: 'Tools' });
    await Certification.create(certDoc({ skillIds: [skill._id] }));

    const res = await request(app).get('/api/v1/skills?withCertifications=true&page=1&limit=10');

    expect(res.body.data[0].certifications).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('preserves hideLevel through the aggregation', async () => {
    await Skill.create({ name: 'Docker', category: 'Tools', hideLevel: true });

    const res = await request(app).get('/api/v1/skills?withCertifications=true');

    expect(res.body[0].hideLevel).toBe(true);
  });

  it('restates schema defaults the aggregation would otherwise drop', async () => {
    // Written through the raw driver, so Mongoose applies no defaults — this is what
    // a document stored before `hideLevel` existed looks like on disk.
    await Skill.collection.insertOne({ name: 'Legacy', category: 'Tools' });

    const res = await request(app).get('/api/v1/skills?withCertifications=true');

    expect(res.body[0].hideLevel).toBe(false);
    expect(res.body[0].level).toBe(3);
    expect(res.body[0].order).toBe(0);
    expect(res.body[0].domains).toEqual([]);
  });
});

// One test per line of the §7 list, each written to be stricter than the incidental
// coverage above — so a regression names the requirement it broke.
describe('§7 required coverage', () => {
  it('removes a deleted skill from EVERY certification that referenced it', async () => {
    const token = await createAdminAndLogin();
    const docker = await Skill.create({ name: 'Docker', category: 'Tools' });
    const node = await Skill.create({ name: 'Node.js', category: 'Backend' });

    // Three certifications, all referencing Docker, one also referencing Node.
    const a = await Certification.create(certDoc({ name: 'A', skillIds: [docker._id] }));
    const b = await Certification.create(certDoc({ name: 'B', skillIds: [docker._id, node._id] }));
    const c = await Certification.create(certDoc({ name: 'C', skillIds: [docker._id], status: 'DRAFT' }));

    await request(app).delete(`/api/v1/skills/${docker.id}`).set('Authorization', `Bearer ${token}`);

    // Every one, including the draft — a stale reference in an unpublished record is
    // still a stale reference.
    for (const id of [a.id, b.id, c.id]) {
      const after = await Certification.findById(id);
      expect(after!.skillIds.map(String)).not.toContain(String(docker._id));
    }
    // Unrelated references survive.
    expect((await Certification.findById(b.id))!.skillIds.map(String)).toEqual([String(node._id)]);
  });

  it('returns an empty array — not null, not a missing key — for uncertified skills', async () => {
    await Skill.create({ name: 'Docker', category: 'Tools' });

    const res = await request(app).get('/api/v1/skills?withCertifications=true');
    const { certifications } = res.body[0];

    expect(Object.keys(res.body[0])).toContain('certifications'); // key present
    expect(certifications).not.toBeNull();
    expect(certifications).toBeDefined();
    expect(Array.isArray(certifications)).toBe(true);
    expect(certifications).toHaveLength(0);
  });

  it('computes isExpired across all three cases: past expiry, neverExpires, and no expiry date', async () => {
    await Certification.create(certDoc({ name: 'Lapsed', expiryDate: new Date(Date.now() - DAY) }));
    await Certification.create(certDoc({ name: 'Perpetual', neverExpires: true }));
    await Certification.create(certDoc({ name: 'Undated', expiryDate: null }));

    // includeExpired so all three are in one response and directly comparable.
    const res = await request(app).get('/api/v1/certifications?includeExpired=true');
    const byName = Object.fromEntries(res.body.map((c: { name: string; isExpired: boolean }) => [c.name, c.isExpired]));

    expect(byName.Lapsed).toBe(true);
    expect(byName.Perpetual).toBe(false);
    expect(byName.Undated).toBe(false);
  });

  it('excludes both expired and draft entries from the public list by default', async () => {
    await Certification.create(certDoc({ name: 'Visible' }));
    await Certification.create(certDoc({ name: 'Lapsed', expiryDate: new Date(Date.now() - DAY) }));
    await Certification.create(certDoc({ name: 'Unpublished', status: 'DRAFT' }));
    // A draft that is also expired must not slip through either filter.
    await Certification.create(certDoc({ name: 'Both', status: 'DRAFT', expiryDate: new Date(Date.now() - DAY) }));

    const res = await request(app).get('/api/v1/certifications');

    expect(res.body.map((c: { name: string }) => c.name)).toEqual(['Visible']);
  });

  it('rejects creating a certification against a skillId that does not exist', async () => {
    const token = await createAdminAndLogin();

    const res = await request(app)
      .post('/api/v1/admin/certifications')
      .set('Authorization', `Bearer ${token}`)
      .send(certPayload({ skillIds: ['507f1f77bcf86cd799439011'], description: 'Covers distributed systems design on AWS.' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await Certification.countDocuments()).toBe(0);
  });

  it('returns all of a skill\'s certifications, most-recent-issued first', async () => {
    const skill = await Skill.create({ name: 'Docker', category: 'Tools' });
    // Inserted out of order so passing can't be an accident of insertion order.
    await Certification.create(certDoc({ name: 'Middle', issueDate: new Date('2022-06-01'), skillIds: [skill._id] }));
    await Certification.create(certDoc({ name: 'Oldest', issueDate: new Date('2019-01-01'), skillIds: [skill._id] }));
    await Certification.create(certDoc({ name: 'Newest', issueDate: new Date('2025-03-01'), skillIds: [skill._id] }));

    const res = await request(app).get('/api/v1/skills?withCertifications=true');

    expect(res.body[0].certifications.map((c: { name: string }) => c.name)).toEqual(['Newest', 'Middle', 'Oldest']);
  });
});
