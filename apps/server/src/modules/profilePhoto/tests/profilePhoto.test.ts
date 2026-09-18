import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { app } from '../../../server';
import { Admin } from '../../auth/admin.model';
import { UPLOADS_DIR } from '../../../config/paths';
import { ProfilePhoto } from '../profilePhoto.model';

async function login() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await Admin.create({ email: 'admin@portfolio.test', passwordHash, name: 'Admin' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@portfolio.test', password: 'admin123' });
  return res.body.access_token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// Only the leading signature bytes are inspected, so these are enough to be "real".
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);

const upload = (token: string, bytes: Buffer, filename: string, contentType: string) =>
  request(app)
    .post('/api/v1/profile-photo')
    .set(auth(token))
    .attach('file', bytes, { filename, contentType });

/** Local provider in tests: the stored key is a filename inside UPLOADS_DIR. */
const onDisk = (storageKey: string) => fs.existsSync(path.join(UPLOADS_DIR, storageKey));

// These tests write real files into the shared uploads directory — sweep ours up so a
// test run never leaves portraits behind.
afterEach(() => {
  if (!fs.existsSync(UPLOADS_DIR)) return;
  for (const name of fs.readdirSync(UPLOADS_DIR)) {
    if (name.startsWith('profile-')) fs.unlinkSync(path.join(UPLOADS_DIR, name));
  }
});

describe('Profile photo — replacing removes the old file', () => {
  it('stores the first upload and serves it publicly', async () => {
    const token = await login();
    const res = await upload(token, PNG, 'me.png', 'image/png');

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/\/uploads\/profile-.+\.png$/);

    const doc = await ProfilePhoto.findOne({ slot: 'hero' });
    expect(onDisk(doc!.storageKey)).toBe(true);

    const pub = await request(app).get('/api/v1/profile-photo');
    expect(pub.status).toBe(200);
    expect(pub.body.url).toBe(res.body.url);
  });

  it('deletes the previous file from storage when a new photo is uploaded', async () => {
    const token = await login();

    await upload(token, PNG, 'first.png', 'image/png');
    const first = (await ProfilePhoto.findOne({ slot: 'hero' }))!.storageKey;
    expect(onDisk(first)).toBe(true);

    const res = await upload(token, JPEG, 'second.jpg', 'image/jpeg');
    expect(res.status).toBe(201);

    const second = (await ProfilePhoto.findOne({ slot: 'hero' }))!.storageKey;
    expect(second).not.toBe(first);
    // The whole point of the feature:
    expect(onDisk(first)).toBe(false);
    expect(onDisk(second)).toBe(true);
    // Still a singleton, not a growing history.
    expect(await ProfilePhoto.countDocuments()).toBe(1);
  });

  it('removes the file and the record on delete, and the public read goes empty', async () => {
    const token = await login();
    await upload(token, PNG, 'me.png', 'image/png');
    const key = (await ProfilePhoto.findOne({ slot: 'hero' }))!.storageKey;

    const del = await request(app).delete('/api/v1/profile-photo').set(auth(token));
    expect(del.status).toBe(204);
    expect(onDisk(key)).toBe(false);
    expect(await ProfilePhoto.countDocuments()).toBe(0);

    expect((await request(app).get('/api/v1/profile-photo')).status).toBe(204);
  });
});

describe('Profile photo — validation', () => {
  it('rejects bytes that are not an image, even with an image name and type', async () => {
    const token = await login();
    const res = await upload(token, Buffer.from('<svg onload="alert(1)"></svg>'), 'me.png', 'image/png');

    expect(res.status).toBe(400);
    expect(await ProfilePhoto.countDocuments()).toBe(0);
    // The rejected upload must not linger in the uploads directory either.
    const leftovers = fs.existsSync(UPLOADS_DIR)
      ? fs.readdirSync(UPLOADS_DIR).filter((n) => n.startsWith('profile-'))
      : [];
    expect(leftovers).toHaveLength(0);
  });

  it('rejects SVG outright', async () => {
    const token = await login();
    const res = await upload(token, Buffer.from('<svg/>'), 'me.svg', 'image/svg+xml');
    expect(res.status).toBe(400);
  });

  it('keeps the existing photo when a bad replacement is rejected', async () => {
    const token = await login();
    await upload(token, PNG, 'good.png', 'image/png');
    const good = (await ProfilePhoto.findOne({ slot: 'hero' }))!.storageKey;

    const bad = await upload(token, Buffer.from('not an image'), 'bad.png', 'image/png');
    expect(bad.status).toBe(400);

    expect((await ProfilePhoto.findOne({ slot: 'hero' }))!.storageKey).toBe(good);
    expect(onDisk(good)).toBe(true);
  });

  it('requires an admin to upload or delete', async () => {
    const up = await request(app)
      .post('/api/v1/profile-photo')
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(up.status).toBe(401);
    expect((await request(app).delete('/api/v1/profile-photo')).status).toBe(401);
  });
});
