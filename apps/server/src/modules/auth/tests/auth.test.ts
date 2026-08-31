import { describe, it, expect } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../admin.model';
import { AuditLog } from '../auditLog.model';

async function createAdmin(overrides: Partial<{ email: string; password: string; name: string }> = {}) {
  const email = overrides.email ?? 'admin@portfolio.test';
  const password = overrides.password ?? 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await Admin.create({ email, passwordHash, name: overrides.name ?? 'Admin' });
  return { admin, email, password };
}

function extractCookieValue(setCookieHeaders: string[], name: string): string {
  const entry = setCookieHeaders.find((c) => c.startsWith(`${name}=`));
  if (!entry) throw new Error(`Cookie ${name} not found in Set-Cookie headers`);
  return entry.split(';')[0].split('=')[1];
}

describe('Auth Modular Endpoints API Integration Tests', () => {
  describe('POST /api/v1/auth/login', () => {
    it('returns 400 validation failed if input is invalid', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ email: 'bad-email', password: '12' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('returns 401 if admin is not found', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@portfolio.test', password: 'admin123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('returns 401 if the password is wrong', async () => {
      const { email } = await createAdmin();

      const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('returns an access token, user info, a refresh cookie, and a csrf cookie on success', async () => {
      const { email, password } = await createAdmin();

      const res = await request(app).post('/api/v1/auth/login').send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeTypeOf('string');
      expect(res.body.user.email).toBe(email);
      const setCookies = res.headers['set-cookie'] as unknown as string[];
      expect(setCookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
      expect(setCookies.some((c) => c.startsWith('csrf_token='))).toBe(true);

      const stored = await Admin.findOne({ email });
      expect(stored?.refreshTokens).toHaveLength(1);
    });

    it('writes an audit log entry for both successful and failed logins', async () => {
      const { email, password } = await createAdmin();

      await request(app).post('/api/v1/auth/login').send({ email, password: 'wrong-password' });
      await request(app).post('/api/v1/auth/login').send({ email, password });

      const events = await AuditLog.find({ email }).sort({ createdAt: 1 });
      expect(events.map((e) => e.event)).toEqual(['LOGIN_FAILURE', 'LOGIN_SUCCESS']);
      expect(events[0].ip).toBeTruthy();
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 403 if no CSRF token is presented at all', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send();

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });

    it('returns 401 if the refresh cookie is missing but CSRF token matches', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'csrf_token=matching-token')
        .set('X-CSRF-Token', 'matching-token')
        .send();

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Refresh token missing');
    });

    it('rejects a mismatched CSRF token even with a valid refresh cookie', async () => {
      const { email, password } = await createAdmin();
      const login = await request(app).post('/api/v1/auth/login').send({ email, password });
      const setCookies = login.headers['set-cookie'] as unknown as string[];
      const rawRefreshValue = extractCookieValue(setCookies, 'refresh_token');

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${rawRefreshValue}`, 'csrf_token=real-token'])
        .set('X-CSRF-Token', 'wrong-token')
        .send();

      expect(res.status).toBe(403);
    });

    it('rejects a refresh token that has already been revoked (e.g. after logout)', async () => {
      const { email, password } = await createAdmin();
      const login = await request(app).post('/api/v1/auth/login').send({ email, password });
      const setCookies = login.headers['set-cookie'] as unknown as string[];
      const rawRefreshValue = extractCookieValue(setCookies, 'refresh_token');
      const rawCsrfValue = extractCookieValue(setCookies, 'csrf_token');

      // logout clears cookies client-side, so grab the raw values first and present them
      // manually — this is what proves the server revoked the token, not just that the
      // browser forgot it.
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`refresh_token=${rawRefreshValue}`])
        .send();

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${rawRefreshValue}`, `csrf_token=${rawCsrfValue}`])
        .set('X-CSRF-Token', rawCsrfValue)
        .send();

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Refresh token has been revoked');
    });

    it('rotates the refresh token and returns a new access token', async () => {
      const { email, password } = await createAdmin();
      const login = await request(app).post('/api/v1/auth/login').send({ email, password });
      const setCookies = login.headers['set-cookie'] as unknown as string[];
      const rawRefreshValue = extractCookieValue(setCookies, 'refresh_token');
      const rawCsrfValue = extractCookieValue(setCookies, 'csrf_token');

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${rawRefreshValue}`, `csrf_token=${rawCsrfValue}`])
        .set('X-CSRF-Token', rawCsrfValue)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeTypeOf('string');

      const stored = await Admin.findOne({ email });
      expect(stored?.refreshTokens).toHaveLength(1); // old one rotated out, new one in
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without an access token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns the admin profile with a valid access token', async () => {
      const { email, password } = await createAdmin();
      const login = await request(app).post('/api/v1/auth/login').send({ email, password });

      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.access_token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(email);
      expect(res.body.passwordHash).toBeUndefined();
    });
  });
});
