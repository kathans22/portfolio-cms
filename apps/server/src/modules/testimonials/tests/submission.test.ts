import { describe, it, expect } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { Testimonial } from '../testimonial.model';

async function login() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await Admin.create({ email: 'admin@portfolio.test', passwordHash, name: 'Admin' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@portfolio.test', password: 'admin123' });
  return res.body.access_token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const VALID = {
  name: 'Priya Menon',
  role: 'Engineering Manager',
  company: 'Northwind',
  email: 'priya@northwind.test',
  quote: 'Rebuilt our order pipeline and it has been rock solid ever since.',
};

const submit = (body: Record<string, unknown>) =>
  request(app).post('/api/v1/testimonials/submit').send(body);

describe('public testimonial submission', () => {
  it('accepts a submission but keeps it off the public list until approved', async () => {
    const res = await submit(VALID);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const stored = await Testimonial.findById(res.body.id);
    // Status and ordering are the owner's call, never the submitter's.
    expect(stored!.status).toBe('PENDING');

    const publicList = await request(app).get('/api/v1/testimonials');
    expect(publicList.body).toHaveLength(0);
  });

  it('ignores a client-supplied status — a submitter cannot self-publish', async () => {
    const res = await submit({ ...VALID, status: 'APPROVED', order: -100 });
    expect(res.status).toBe(201);

    const stored = await Testimonial.findById(res.body.id);
    expect(stored!.status).toBe('PENDING');
    expect((await request(app).get('/api/v1/testimonials')).body).toHaveLength(0);
  });

  it('never exposes the submitter email on a public read', async () => {
    const created = await Testimonial.create({ ...VALID, status: 'APPROVED' });
    expect(created.email).toBe(VALID.email);

    const publicList = await request(app).get('/api/v1/testimonials');
    expect(publicList.body).toHaveLength(1);
    expect(publicList.body[0].email).toBeUndefined();
  });

  it('drops a honeypot submission without persisting it', async () => {
    const res = await submit({ ...VALID, website: 'http://spam.example' });
    // Reports success so the bot learns nothing…
    expect(res.status).toBe(201);
    expect(res.body.id).toBeNull();
    // …but nothing was written.
    expect(await Testimonial.countDocuments()).toBe(0);
  });

  it('rejects a quote that is too short', async () => {
    const res = await submit({ ...VALID, quote: 'nice' });
    expect(res.status).toBe(400);
  });

  it('still shows testimonials created before the status field existed', async () => {
    // Written through the raw driver so no Mongoose default is applied — exactly the
    // shape of a row that predates moderation.
    await Testimonial.collection.insertOne({
      name: 'Legacy', role: 'CTO', quote: 'Predates the status field entirely.', order: 0,
    });

    const publicList = await request(app).get('/api/v1/testimonials');
    expect(publicList.body).toHaveLength(1);
    expect(publicList.body[0].name).toBe('Legacy');
  });
});

describe('testimonial moderation', () => {
  it('requires an admin for the moderation list', async () => {
    expect((await request(app).get('/api/v1/testimonials/all')).status).toBe(401);
  });

  it('publishes a submission once approved', async () => {
    const token = await login();
    const { body } = await submit(VALID);

    const all = await request(app).get('/api/v1/testimonials/all').set(auth(token));
    expect(all.body).toHaveLength(1);
    expect(all.body[0].status).toBe('PENDING');

    const approved = await request(app)
      .patch(`/api/v1/testimonials/${body.id}/approve`)
      .set(auth(token));
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');

    const publicList = await request(app).get('/api/v1/testimonials');
    expect(publicList.body).toHaveLength(1);
    expect(publicList.body[0].name).toBe(VALID.name);
  });

  it('404s approving an id that does not exist', async () => {
    const token = await login();
    const res = await request(app)
      .patch('/api/v1/testimonials/6a5f1774dba1f9fca9dc463f/approve')
      .set(auth(token));
    expect(res.status).toBe(404);
  });
});
