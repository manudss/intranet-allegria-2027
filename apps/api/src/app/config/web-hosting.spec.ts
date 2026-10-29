import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isSpaFallbackRequest, resolveWebStaticDir } from './web-hosting';

describe('web hosting (preview only)', () => {
  it('is disabled when WEB_STATIC_DIR is empty or has no index.html', () => {
    expect(resolveWebStaticDir(undefined)).toBeUndefined();
    expect(resolveWebStaticDir('  ')).toBeUndefined();
    expect(resolveWebStaticDir(mkdtempSync(join(tmpdir(), 'web-')))).toBeUndefined();
  });

  it('is enabled when the directory contains index.html', () => {
    const dir = mkdtempSync(join(tmpdir(), 'web-'));
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    expect(resolveWebStaticDir(dir)).toBe(dir);
  });

  it('never falls back to index.html for API or health routes', () => {
    expect(isSpaFallbackRequest('GET', '/participants')).toBe(true);
    expect(isSpaFallbackRequest('GET', '/api/participants')).toBe(false);
    expect(isSpaFallbackRequest('GET', '/api')).toBe(false);
    expect(isSpaFallbackRequest('GET', '/health')).toBe(false);
    expect(isSpaFallbackRequest('POST', '/participants')).toBe(false);
  });
});
