import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';

const DRIVE = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view?usp=sharing';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function login() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await Admin.create({ email: 'admin@portfolio.test', passwordHash, name: 'Admin' });
  const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@portfolio.test', password: 'admin123' });
  return { Authorization: `Bearer ${res.body.access_token as string}` };
}

/** Stubs only the outbound fetch to Drive; supertest talks to the app directly. */
function stubDrive(body: Buffer, type = 'image/png', status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array(body), { status, headers: { 'content-type': type } }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('site favicon', () => {
  it('requires an admin to change it', async () => {
    const res = await request(app).put('/api/v1/admin/site-settings/favicon').send({ url: DRIVE });
    expect(res.status).toBe(401);
  });

  it('rejects a link that is not an image (e.g. Drive sign-in page)', async () => {
    const auth = await login();
    stubDrive(Buffer.from('<html>Sign in</html>'), 'text/html');
    const res = await request(app).put('/api/v1/admin/site-settings/favicon').set(auth).send({ url: DRIVE });
    expect(res.status).toBe(400);
  });

  it('rejects private / non-https hosts', async () => {
    const auth = await login();
    for (const url of ['http://example.com/a.png', 'https://localhost/a.png', 'https://192.168.1.5/a.png']) {
      const res = await request(app).put('/api/v1/admin/site-settings/favicon').set(auth).send({ url });
      expect(res.status).toBe(400);
    }
  });

  it('saves a Drive image, serves its bytes publicly, and can remove it', async () => {
    const auth = await login();
    expect((await request(app).get('/api/v1/site-settings')).body.hasFavicon).toBe(false);

    stubDrive(PNG);
    const saved = await request(app).put('/api/v1/admin/site-settings/favicon').set(auth).send({ url: DRIVE });
    expect(saved.status).toBe(200);
    expect(saved.body.hasFavicon).toBe(true);

    expect((await request(app).get('/api/v1/site-settings')).body.hasFavicon).toBe(true);
    // Origin sent, as a browser canvas redraw (the circular crop) would.
    const icon = await request(app).get('/api/v1/site-settings/favicon').set('Origin', 'http://localhost:3000');
    expect(icon.status).toBe(200);
    expect(icon.headers['content-type']).toBe('image/png');
    expect(icon.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(icon.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    const removed = await request(app).delete('/api/v1/admin/site-settings/favicon').set(auth);
    expect(removed.status).toBe(204);
    expect((await request(app).get('/api/v1/site-settings/favicon')).status).toBe(404);
  });
});
