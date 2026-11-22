import { it, expect } from 'vitest';
import express from 'express';
import { configureTrustProxy } from './trust-proxy';

async function listen(app: express.Express) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  return { server, base: 'http://127.0.0.1:' + (server.address() as { port: number }).port };
}

it('trusts one proxy hop so the balancer-appended client IP drives rate limiting', async () => {
  const app = express();
  configureTrustProxy(app as never);
  app.get('/probe', (req, res) => res.json({ ip: req.ip, ips: req.ips }));
  const { server, base } = await listen(app);
  try {
    // The platform balancer appends the real client address last; a client may
    // prepend anything. Only the balancer-observed entry may key the throttler.
    const spoofed = await (
      await fetch(base + '/probe', {
        headers: { 'x-forwarded-for': '203.0.113.10, 198.51.100.23' },
      })
    ).json();
    expect(spoofed.ip).toBe('198.51.100.23');
    expect(spoofed.ips[0]).toBe('198.51.100.23');

    const direct = await (await fetch(base + '/probe')).json();
    expect(direct.ip).toBe('127.0.0.1');
  } finally {
    await new Promise<void>((r, e) => server.close((err) => (err ? e(err) : r())));
  }
});
