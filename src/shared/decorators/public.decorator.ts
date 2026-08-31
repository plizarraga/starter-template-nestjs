import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as reachable without an authenticated session.
 *
 * The marker itself carries no authentication logic — it is route metadata that
 * both core operational routes and business features attach, and that
 * `SessionGuard` interprets. It lives in `shared/` so global infrastructure
 * never has to import a business feature.
 */
export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
