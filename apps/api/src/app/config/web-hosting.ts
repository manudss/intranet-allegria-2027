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
