import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Trust exactly one proxy hop (Render's load balancer) so Express
 * resolves req.ip to the rightmost X-Forwarded-For entry instead of
 * the balancer's socket IP, which was shared by every visitor and let
 * the NestJS throttler bucket (5 req / 10 min on /api/familles/access)
 * be exhausted collectively.
 *
 * Known limit (2026-11): Render routes inbound traffic through
 * Cloudflare before the app. If Render's balancer appends Cloudflare's
 * egress IP to X-Forwarded-For, req.ip is that egress IP: still
 * fail-closed (client-supplied XFF entries further left are ignored),
 * but buckets may be shared per Cloudflare egress rather than per
 * visitor. If Render passes X-Forwarded-For through, req.ip is the
 * real client. This topology was not probe-verified; if collective
 * 429s reappear during mass signups, verify the route type, then
 * consider trust proxy = 2 or a tracker keyed on CF-Connecting-IP.
 */
export function configureTrustProxy(app: NestExpressApplication) {
  app.set('trust proxy', 1);
}
