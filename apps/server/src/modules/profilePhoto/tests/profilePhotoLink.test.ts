import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { UPLOADS_DIR } from '../../../config/paths';
import { ProfilePhoto } from '../profilePhoto.model';
import { toDirectImageUrl } from '../routes';

async function login() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await Admin.create({ email: 'admin@portfolio.test', passwordHash, name: 'Admin' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@portfolio.test', password: 'admin123' });
  return res.body.access_token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

const DRIVE_SHARE = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view?usp=sharing';
const DRIVE_DIRECT = 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQrSt=w1600';

// The server fetches the link to confirm it's a real image. Stub that network call so
// the suite never depends on Google being reachable.
function stubFetch(body: Buffer | string, status: number, contentType: string) {
  // Response wants a web body type; a Node Buffer has to be handed over as bytes.
  const payload = typeof body === 'string' ? body : new Uint8Array(body);
  const fetchMock = vi.fn(
    async (_input: string | URL | Request) =>
      new Response(payload, { status, headers: { 'content-type': contentType } })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const setLink = (token: string, url: string) =>
  request(app).post('/api/v1/profile-photo/link').set(auth(token)).send({ url });

afterEach(() => {
  vi.unstubAllGlobals();
  if (!fs.existsSync(UPLOADS_DIR)) return;
  for (const name of fs.readdirSync(UPLOADS_DIR)) {
    if (name.startsWith('profile-')) fs.unlinkSync(path.join(UPLOADS_DIR, name));
  }
});

describe('toDirectImageUrl', () => {
  it('converts every common Google Drive link shape to a direct image URL', () => {
    expect(toDirectImageUrl(DRIVE_SHARE)).toBe(DRIVE_DIRECT);
    expect(toDirectImageUrl('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrSt')).toBe(DRIVE_DIRECT);
    expect(toDirectImageUrl('https://drive.google.com/uc?export=view&id=1AbCdEfGhIjKlMnOpQrSt')).toBe(DRIVE_DIRECT);
  });

  it('leaves non-Drive links and Drive folder links alone', () => {
    expect(toDirectImageUrl('https://example.com/me.jpg')).toBe('https://example.com/me.jpg');
    expect(toDirectImageUrl('https://drive.google.com/drive/folders/abc')).toBe(
      'https://drive.google.com/drive/folders/abc'
    );
  });
});

describe('Profile photo — image link', () => {
  it('stores a Drive share link as its direct image URL and serves it publicly', async () => {
    const token = await login();
    const fetchMock = stubFetch(PNG, 200, 'image/png');

    const res = await setLink(token, DRIVE_SHARE);
    expect(res.status).toBe(201);
    expect(res.body.url).toBe(DRIVE_DIRECT);
    expect(res.body.source).toBe('link');
    expect(res.body.sourceUrl).toBe(DRIVE_SHARE);
    // It verified the converted address, not the viewer page.
    expect(fetchMock.mock.calls[0][0]).toBe(DRIVE_DIRECT);

    const pub = await request(app).get('/api/v1/profile-photo');
    expect(pub.body.url).toBe(DRIVE_DIRECT);
  });

  it('rejects a Drive file that is not shared publicly, with advice, and saves nothing', async () => {
    const token = await login();
    // What Google actually returns for a private or missing file: an HTML error page.
    stubFetch('<!DOCTYPE html><html>Error 400</html>', 400, 'text/html; charset=UTF-8');

    const res = await setLink(token, DRIVE_SHARE);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Anyone with the link/);
    expect(await ProfilePhoto.countDocuments()).toBe(0);
  });

  it('rejects a response that claims to be an image but is not', async () => {
    const token = await login();
    stubFetch('<!DOCTYPE html>', 200, 'image/png');

    const res = await setLink(token, 'https://example.com/fake.png');
    expect(res.status).toBe(400);
    expect(await ProfilePhoto.countDocuments()).toBe(0);
  });

  it('refuses plain http links before fetching anything', async () => {
    const token = await login();
    const fetchMock = stubFetch(PNG, 200, 'image/png');

    const res = await setLink(token, 'http://example.com/me.png');
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes a previously uploaded file when switching to a link', async () => {
    const token = await login();
    await request(app)
      .post('/api/v1/profile-photo')
      .set(auth(token))
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' });
    const uploadedKey = (await ProfilePhoto.findOne({ slot: 'hero' }))!.storageKey;
    expect(fs.existsSync(path.join(UPLOADS_DIR, uploadedKey))).toBe(true);

    stubFetch(PNG, 200, 'image/png');
    expect((await setLink(token, DRIVE_SHARE)).status).toBe(201);

    expect(fs.existsSync(path.join(UPLOADS_DIR, uploadedKey))).toBe(false);
    expect(await ProfilePhoto.countDocuments()).toBe(1);
  });

  it('switches back to an uploaded file cleanly after using a link', async () => {
    const token = await login();
    stubFetch(PNG, 200, 'image/png');
    await setLink(token, DRIVE_SHARE);
    vi.unstubAllGlobals();

    const res = await request(app)
      .post('/api/v1/profile-photo')
      .set(auth(token))
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe('upload');
    expect(res.body.sourceUrl).toBeUndefined();
    expect((await ProfilePhoto.findOne({ slot: 'hero' }))!.sourceUrl).toBeUndefined();
  });

  it('requires an admin', async () => {
    const res = await request(app).post('/api/v1/profile-photo/link').send({ url: DRIVE_SHARE });
    expect(res.status).toBe(401);
  });
});
