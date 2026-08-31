import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server';

describe('GET /api/v1/health', () => {
  it('reports ok with a connected database', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
  });
});
