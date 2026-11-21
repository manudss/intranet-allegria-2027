import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import express from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';
/** Family UI and its HttpOnly session share an origin. No third-party cookie dependency. */
export function configureFamilyPortal(
  app: NestExpressApplication,
  dir = resolve(__dirname, '../family-portal/browser'),
) {
  const root = existsSync(join(dir, 'index.html'))
    ? dir
    : resolve(process.cwd(), 'dist/apps/family-portal/browser');
  if (!existsSync(join(root, 'index.html'))) return false;
  app.use('/familles', express.static(root, { index: false, maxAge: 0 }));
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (
      !['GET', 'HEAD'].includes(req.method) ||
      !(req.path === '/familles' || req.path.startsWith('/familles/'))
    )
      return next();
    if (req.path === '/familles') return res.redirect(302, '/familles/espace-famille');
    if (req.path.startsWith('/familles/api') || req.path.split('/').pop()?.includes('.'))
      return res.status(404).end();
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(join(root, 'index.html'));
  });
  return true;
}
