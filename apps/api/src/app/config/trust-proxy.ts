import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Trust exactly one proxy hop: the platform load balancer (Render).
 * Express then resolves req.ip / req.ips[0] to the rightmost
 * X-Forwarded-For entry, appended by the balancer itself, so the
 * throttler buckets per visitor instead of per shared balancer IP.
 * Client-supplied X-Forwarded-For entries sit further left and are
 * ignored, so the rate-limit boundary cannot be spoofed this way.
 */
export function configureTrustProxy(app: NestExpressApplication) {
  app.set('trust proxy', 1);
}
