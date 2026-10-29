import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a controller or a route as reachable without a bearer token.
 * Everything else is protected by the global GlobalAuthGuard (default deny).
 * Keep the list of public routes minimal: it is pinned by public-routes.spec.ts.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
