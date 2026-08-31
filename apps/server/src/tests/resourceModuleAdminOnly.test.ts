/**
 * The admin-only guarantee for the Resource Management module, tested rather than
 * assumed.
 *
 * This module is a private bookmarking tool. Nothing in it may ever reach an
 * unauthenticated visitor, and the CMS is specifically designed to let admin-managed
 * content reach the public site — so the absence of a section type is a load-bearing
 * guard, not a documentation detail. Each test here fails loudly if someone later adds
 * the "obvious" public read endpoint or registry entry.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { app } from '../server';
import { SECTION_TYPES, SECTION_TYPE_KEYS, SectionType } from '@portfolio/shared';

// Every endpoint the module exposes. Adding a route without adding it here is the
// mistake this list exists to catch, so it is spelled out rather than derived.
const ENDPOINTS: [string, string][] = [
  ['get', '/api/v1/admin/main-types'],
  ['get', '/api/v1/admin/main-types/options'],
  ['post', '/api/v1/admin/main-types/6a6c8ea47b888b8a59d2374a/restore'],
  ['post', '/api/v1/admin/main-types'],
  ['patch', '/api/v1/admin/main-types/6a6c8ea47b888b8a59d2374a'],
  ['delete', '/api/v1/admin/main-types/6a6c8ea47b888b8a59d2374a'],
  ['get', '/api/v1/admin/sub-types'],
  ['get', '/api/v1/admin/sub-types/options'],
  ['post', '/api/v1/admin/sub-types/6a6c8ea47b888b8a59d2374a/restore'],
  ['post', '/api/v1/admin/sub-types'],
  ['patch', '/api/v1/admin/sub-types/6a6c8ea47b888b8a59d2374a'],
  ['delete', '/api/v1/admin/sub-types/6a6c8ea47b888b8a59d2374a'],
  ['get', '/api/v1/admin/resources'],
  ['post', '/api/v1/admin/resources/6a6c8ea47b888b8a59d2374a/restore'],
  ['post', '/api/v1/admin/resources'],
  ['patch', '/api/v1/admin/resources/6a6c8ea47b888b8a59d2374a'],
  ['delete', '/api/v1/admin/resources/6a6c8ea47b888b8a59d2374a'],
];

describe('Resource module — every endpoint requires authentication', () => {
  for (const [method, url] of ENDPOINTS) {
    it(`${method.toUpperCase()} ${url} returns 401 without a token`, async () => {
      const res = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[method](url).send({});
      expect(res.status).toBe(401);
    });
  }

  it('rejects a garbage bearer token too, not just a missing one', async () => {
    const res = await request(app)
      .get('/api/v1/admin/resources')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('Resource module — no public surface exists', () => {
  const PUBLIC_GUESSES = [
    '/api/v1/resources',
    '/api/v1/main-types',
    '/api/v1/sub-types',
  ];

  for (const url of PUBLIC_GUESSES) {
    it(`${url} is not routed at all`, async () => {
      const res = await request(app).get(url);
      // 404 means nothing is mounted there. A 200 would mean a public variant exists;
      // a 401 would mean one exists but is guarded, which is still a route that should
      // not have been created.
      expect(res.status).toBe(404);
    });
  }
});

describe('Resource module — the CMS cannot reach this data', () => {
  it('registers no section type for resources or their taxonomy', () => {
    const forbidden = /RESOURCE|MAIN_TYPE|SUB_TYPE/i;
    const offenders = SECTION_TYPE_KEYS.filter((key) => forbidden.test(key));
    expect(offenders).toEqual([]);
  });

  it('has no section type whose backing collection is a model from this module', () => {
    const privateModels = ['Resource', 'MainType', 'SubType'];
    const wired = SECTION_TYPE_KEYS
      .map((key) => (SECTION_TYPES[key as SectionType] as { collection?: string }).collection)
      .filter((collection): collection is string => !!collection);

    for (const model of privateModels) {
      expect(wired).not.toContain(model);
    }
  });

  it('is not imported by the resolver, so /resolve can never return this data', () => {
    // A static read of the source: an import is the only way this data could reach the
    // resolver, and catching it here is cheaper than discovering it in a payload.
    const resolverDir = path.resolve(__dirname, '../modules/resolve');
    const sources = fs
      .readdirSync(resolverDir)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => fs.readFileSync(path.join(resolverDir, file), 'utf8'));

    for (const source of sources) {
      expect(source).not.toMatch(/from '\.\.\/(resources|mainTypes|subTypes)\//);
      expect(source).not.toMatch(/\b(Resource|MainType|SubType)\b\s*(,|\})/);
    }
  });

  it('resolves a would-be resource URL to NOT_FOUND, since resources have no public path', async () => {
    const res = await request(app).get('/api/v1/resolve?path=/resources');
    expect(res.body.kind).toBe('NOT_FOUND');
  });
});
