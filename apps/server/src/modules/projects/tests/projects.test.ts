import { describe, it, expect } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { Project } from '../project.model';

async function createAdminAndLogin() {
  const email = 'admin@portfolio.test';
  const password = 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);
  await Admin.create({ email, passwordHash, name: 'Admin' });

  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  return login.body.access_token as string;
}

const validProjectPayload = {
  title: 'Aura CMS Platform',
  slug: 'aura-cms-platform',
  summary: 'A headless content management system.',
  description: 'A headless content management system with real-time editing and asset management.',
};

describe('Projects API Integration Tests', () => {
  describe('GET /api/v1/projects', () => {
    it('only returns published projects for unauthenticated requests', async () => {
      await Project.create({ ...validProjectPayload, status: 'PUBLISHED' });
      await Project.create({ ...validProjectPayload, slug: 'draft-project', status: 'DRAFT' });

      const res = await request(app).get('/api/v1/projects');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('PUBLISHED');
    });

    it('returns drafts too when an admin bearer token is presented', async () => {
      const token = await createAdminAndLogin();
      await Project.create({ ...validProjectPayload, status: 'PUBLISHED' });
      await Project.create({ ...validProjectPayload, slug: 'draft-project', status: 'DRAFT' });

      const res = await request(app).get('/api/v1/projects').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('returns a plain array when no page/limit params are given', async () => {
      await Project.create({ ...validProjectPayload, status: 'PUBLISHED' });

      const res = await request(app).get('/api/v1/projects');

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns a paginated envelope when page/limit params are given', async () => {
      await Project.create({ ...validProjectPayload, status: 'PUBLISHED' });
      await Project.create({ ...validProjectPayload, slug: 'second-project', status: 'PUBLISHED' });
      await Project.create({ ...validProjectPayload, slug: 'third-project', status: 'PUBLISHED' });

      const res = await request(app).get('/api/v1/projects?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });

      const secondPage = await request(app).get('/api/v1/projects?page=2&limit=2');
      expect(secondPage.body.data).toHaveLength(1);
    });

    it('filters by domain', async () => {
      await Project.create({ ...validProjectPayload, status: 'PUBLISHED', domains: ['AI_ENGINEERING'] });
      await Project.create({ ...validProjectPayload, slug: 'other-project', status: 'PUBLISHED', domains: ['DATA_ENGINEERING'] });

      const res = await request(app).get('/api/v1/projects?domain=AI_ENGINEERING');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].domains).toContain('AI_ENGINEERING');
    });
  });

  describe('GET /api/v1/projects/:slug', () => {
    it('returns 404 for a draft project when unauthenticated', async () => {
      await Project.create({ ...validProjectPayload, status: 'DRAFT' });

      const res = await request(app).get(`/api/v1/projects/${validProjectPayload.slug}`);
      expect(res.status).toBe(404);
    });

    it('returns a draft project when authenticated as admin', async () => {
      const token = await createAdminAndLogin();
      await Project.create({ ...validProjectPayload, status: 'DRAFT' });

      const res = await request(app)
        .get(`/api/v1/projects/${validProjectPayload.slug}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(validProjectPayload.slug);
    });

    it('returns 404 for a slug that does not exist', async () => {
      const res = await request(app).get('/api/v1/projects/does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/projects', () => {
    it('returns 401 without an admin token', async () => {
      const res = await request(app).post('/api/v1/projects').send(validProjectPayload);
      expect(res.status).toBe(401);
    });

    it('returns 400 when the payload fails validation', async () => {
      const token = await createAdminAndLogin();

      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'AB' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('creates a project with a valid payload and admin token', async () => {
      const token = await createAdminAndLogin();

      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProjectPayload);

      expect(res.status).toBe(201);
      expect(res.body.slug).toBe(validProjectPayload.slug);
      expect(res.body.id).toBeTypeOf('string');
    });

    it('returns 409 for a duplicate slug', async () => {
      const token = await createAdminAndLogin();
      await Project.create(validProjectPayload);

      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(validProjectPayload);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('PATCH /api/v1/projects/:id', () => {
    it('updates an existing project', async () => {
      const token = await createAdminAndLogin();
      const project = await Project.create(validProjectPayload);

      const res = await request(app)
        .patch(`/api/v1/projects/${project.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validProjectPayload, title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
    });

    it('returns 404 when updating a project that does not exist', async () => {
      const token = await createAdminAndLogin();

      const res = await request(app)
        .patch('/api/v1/projects/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send(validProjectPayload);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('deletes an existing project', async () => {
      const token = await createAdminAndLogin();
      const project = await Project.create(validProjectPayload);

      const res = await request(app)
        .delete(`/api/v1/projects/${project.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(await Project.findById(project.id)).toBeNull();
    });

    it('returns 401 without an admin token', async () => {
      const project = await Project.create(validProjectPayload);

      const res = await request(app).delete(`/api/v1/projects/${project.id}`);
      expect(res.status).toBe(401);
    });
  });
});
