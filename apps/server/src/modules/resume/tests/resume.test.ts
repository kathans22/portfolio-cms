import { describe, it, expect } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { Resume } from '../resume.model';

async function login() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await Admin.create({ email: 'admin@portfolio.test', passwordHash, name: 'Admin' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@portfolio.test', password: 'admin123' });
  return res.body.access_token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const PDF_BYTES = Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

const uploadPdf = (token: string, bytes: Buffer, filename = 'cv.pdf', label?: string) => {
  let req = request(app)
    .post('/api/v1/admin/resume/upload')
    .set(auth(token))
    .attach('file', bytes, { filename, contentType: 'application/pdf' });
  if (label !== undefined) req = req.field('label', label);
  return req;
};

describe('Resume — upload validation', () => {
  it('accepts a real PDF and, being the first, makes it active', async () => {
    const token = await login();
    const res = await uploadPdf(token, PDF_BYTES);

    expect(res.status).toBe(201);
    expect(res.body.isActive).toBe(true);
    expect(res.body.originalName).toBe('cv.pdf');
    expect(await Resume.countDocuments()).toBe(1);
  });

  it('rejects a file whose bytes are not a PDF, even with a .pdf name and application/pdf type', async () => {
    const token = await login();
    const res = await uploadPdf(token, Buffer.from('GIF89a......not a pdf"'), 'cv.pdf');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not a valid pdf/i);
    expect(await Resume.countDocuments()).toBe(0);
  });

  it('rejects a non-pdf extension / content-type outright', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/v1/admin/resume/upload')
      .set(auth(token))
      .attach('file', PDF_BYTES, { filename: 'cv.docx', contentType: 'application/msword' });

    expect(res.status).toBe(400);
    expect(await Resume.countDocuments()).toBe(0);
  });

  it('requires an admin token', async () => {
    const res = await request(app)
      .post('/api/v1/admin/resume/upload')
      .attach('file', PDF_BYTES, { filename: 'cv.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(401);
  });
});

describe('Resume — exactly one active version', () => {
  it('leaves a second upload inactive and switches the active one on activate', async () => {
    const token = await login();
    const first = (await uploadPdf(token, PDF_BYTES, 'v1.pdf')).body;
    const second = (await uploadPdf(token, PDF_BYTES, 'v2.pdf')).body;

    expect(first.isActive).toBe(true);
    expect(second.isActive).toBe(false);

    const activated = await request(app)
      .patch(`/api/v1/admin/resume/${second.id}/activate`)
      .set(auth(token));
    expect(activated.status).toBe(200);
    expect(activated.body.isActive).toBe(true);

    expect((await Resume.findById(first.id))!.isActive).toBe(false);
    expect(await Resume.countDocuments({ isActive: true })).toBe(1);
  });

  it('re-activating an existing version is how you roll back', async () => {
    const token = await login();
    const first = (await uploadPdf(token, PDF_BYTES, 'v1.pdf')).body;
    const second = (await uploadPdf(token, PDF_BYTES, 'v2.pdf')).body;

    await request(app).patch(`/api/v1/admin/resume/${second.id}/activate`).set(auth(token));
    await request(app).patch(`/api/v1/admin/resume/${first.id}/activate`).set(auth(token));

    expect((await Resume.findById(first.id))!.isActive).toBe(true);
    expect((await Resume.findById(second.id))!.isActive).toBe(false);
  });
});

describe('Resume — delete rules', () => {
  it('refuses to delete the active version, allows deleting an inactive one', async () => {
    const token = await login();
    const first = (await uploadPdf(token, PDF_BYTES, 'v1.pdf')).body;
    const second = (await uploadPdf(token, PDF_BYTES, 'v2.pdf')).body;

    const blocked = await request(app).delete(`/api/v1/admin/resume/${first.id}`).set(auth(token));
    expect(blocked.status).toBe(409);

    const ok = await request(app).delete(`/api/v1/admin/resume/${second.id}`).set(auth(token));
    expect(ok.status).toBe(204);
    expect(await Resume.countDocuments()).toBe(1);
  });
});

describe('Resume — rename', () => {
  it('updates the label', async () => {
    const token = await login();
    const created = (await uploadPdf(token, PDF_BYTES)).body;

    const res = await request(app)
      .patch(`/api/v1/admin/resume/${created.id}`)
      .set(auth(token))
      .send({ label: 'Backend CV — 2026' });

    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Backend CV — 2026');
  });
});

describe('Resume — public endpoint', () => {
  it('404s when nothing is active', async () => {
    const res = await request(app).get('/api/v1/resume');
    expect(res.status).toBe(404);
  });

  it('returns only the active version and never leaks storage keys', async () => {
    const token = await login();
    await uploadPdf(token, PDF_BYTES, 'active.pdf', 'My CV');
    await uploadPdf(token, PDF_BYTES, 'old.pdf');

    const res = await request(app).get('/api/v1/resume');
    expect(res.status).toBe(200);
    expect(res.body.originalName).toBe('active.pdf');
    expect(res.body.label).toBe('My CV');
    expect(res.body.storageKey).toBeUndefined();
    expect(res.body.isActive).toBeUndefined();
  });

  it('redirects /resume/download to the active file', async () => {
    const token = await login();
    await uploadPdf(token, PDF_BYTES);

    const res = await request(app).get('/api/v1/resume/download').redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/uploads\/resume-/);
  });

  it('serves /resume/file as an inline PDF with framing headers stripped', async () => {
    const token = await login();
    await uploadPdf(token, PDF_BYTES);

    const res = await request(app).get('/api/v1/resume/file');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/^inline/);
    // helmet sets these globally; the route removes them so the client origin can embed it.
    expect(res.headers['x-frame-options']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.body.toString('latin1').startsWith('%PDF-')).toBe(true);
  });

  it('404s /resume/file when nothing is active', async () => {
    const res = await request(app).get('/api/v1/resume/file');
    expect(res.status).toBe(404);
  });
});
