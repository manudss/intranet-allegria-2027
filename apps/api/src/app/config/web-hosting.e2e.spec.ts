import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Controller, Get } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ExpressAdapter } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureExtraMounts, configureWebHosting, resolveExtraMounts } from './web-hosting';

@Controller()
class ProbeController {
  @Get('api/ping')
  ping() {
    return { ok: true };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

const front = (name: string) => {
  const dir = mkdtempSync(join(tmpdir(), `${name}-`));
  writeFileSync(join(dir, 'index.html'), `<html>${name}</html>`);
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'main.js'), `// ${name} bundle`);
  return dir;
};

describe('preview hosting: API + intranet + site + mobile on one process', () => {
  let app: NestExpressApplication;
  let base: string;
  beforeAll(async () => {
    const web = front('intranet');
    const site = front('site');
    const mobile = front('mobile');
    app = await NestFactory.create<NestExpressApplication>(ProbeModule, new ExpressAdapter(), { logger: false });
    configureExtraMounts(app, resolveExtraMounts(`site=${site},m=${mobile}`));
    configureWebHosting(app, web);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => app.close());

  const get = async (path: string) => {
    const res = await fetch(base + path, { redirect: 'manual' });
    return { status: res.status, body: await res.text(), location: res.headers.get('location') };
  };

  it('serves each front under its own prefix and keeps the API reachable', async () => {
    expect((await get('/api/ping')).body).toContain('"ok":true');
    expect((await get('/participants')).body).toContain('intranet');
    expect((await get('/site/')).body).toContain('site');
    expect((await get('/site/programme/deep/link')).body).toContain('site');
    expect((await get('/site/main.js')).body).toContain('site bundle');
    expect((await get('/m/')).body).toContain('mobile');
    expect((await get('/m/main.js')).body).toContain('mobile bundle');
    expect((await get('/main.js')).body).toContain('intranet bundle');
  });

  it('redirects the bare prefix to the trailing-slash form', async () => {
    const r = await get('/site');
    expect(r.status).toBe(301);
    expect(r.location).toBe('/site/');
  });
});
