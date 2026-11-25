import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

/**
 * Optional: serve the built Angular app from the API process.
 * Used only for single-service preview deployments (WEB_STATIC_DIR set).
 * Production keeps the front on its own host and never sets this variable.
 */
export const resolveWebStaticDir = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const dir = resolve(trimmed);
  return existsSync(join(dir, 'index.html')) ? dir : undefined;
};

export const isSpaFallbackRequest = (method: string, path: string): boolean =>
  (method === 'GET' || method === 'HEAD') &&
  path !== '/health' &&
  path !== '/api' &&
  !path.startsWith('/api/');

export const configureWebHosting = (app: NestExpressApplication, dir: string): void => {
  app.useStaticAssets(dir, { index: false });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isSpaFallbackRequest(req.method, req.path)) return next();
    res.sendFile(join(dir, 'index.html'));
  });
};

export interface ExtraMount {
  prefix: string;
  dir: string;
}

/**
 * Preview only: extra front-ends served by the same process under a path prefix
 * (one free Render service carries API + intranet + public site + mobile app).
 * Format: `site=/app/dist/apps/site/browser,m=/app/dist/apps/mobile/browser`.
 * A mount without index.html is skipped. Each front must be built with the matching --base-href.
 */
export const resolveExtraMounts = (value: string | undefined): ExtraMount[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [rawPrefix, ...rest] = entry.split('=');
      const prefix = (rawPrefix ?? '').trim();
      const dir = resolve(rest.join('=').trim());
      if (!/^[a-z0-9-]+$/.test(prefix) || prefix === 'api' || !existsSync(join(dir, 'index.html'))) return [];
      return [{ prefix, dir }];
    });

export const isMountRequest = (method: string, path: string, prefix: string): boolean =>
  (method === 'GET' || method === 'HEAD') && (path === `/${prefix}` || path.startsWith(`/${prefix}/`));

export const configureExtraMounts = (app: NestExpressApplication, mounts: ExtraMount[]): void => {
  for (const { prefix, dir } of mounts) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path === `/${prefix}`) return res.redirect(301, `/${prefix}/`);
      return next();
    });
    app.useStaticAssets(dir, { prefix: `/${prefix}/`, index: false });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!isMountRequest(req.method, req.path, prefix)) return next();
      res.sendFile(join(dir, 'index.html'));
    });
  }
};
