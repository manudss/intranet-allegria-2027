import { it, expect } from 'vitest';
import express from 'express';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configureFamilyPortal } from './family-portal-hosting';
it('serves only the private portal path and never rewrites API, mutations or missing assets', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'family-portal-'));
  writeFileSync(join(dir, 'index.html'), '<html><base href="/familles/">Portail fictif</html>');
  writeFileSync(join(dir, 'main.js'), '/* fictitious asset */');
  const app = express();
  configureFamilyPortal({ use: app.use.bind(app) } as never, dir);
  app.get('/api/test', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const port = (server.address() as { port: number }).port,
    base = 'http://127.0.0.1:' + port;
  try {
    const r = await fetch(base + '/familles/espace-famille');
    expect(await r.text()).toContain('Portail fictif');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect((await fetch(base + '/familles/missing.js')).status).toBe(404);
    expect((await fetch(base + '/api/test')).status).toBe(200);
    expect((await fetch(base + '/familles/espace-famille', { method: 'POST' })).status).toBe(404);
  } finally {
    await new Promise<void>((r, e) => server.close((err) => (err ? e(err) : r())));
  }
});
