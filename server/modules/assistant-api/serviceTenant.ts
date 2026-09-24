/**
 * Tenant selection for the assistant's SERVICE-TO-SERVICE routes in multi-tenant mode (23-Sep-2026).
 *
 * The central assistant calls `POST /assistant/execute` (and `GET /assistant/manifest`) on the module.
 * That hop carries no SAILERP Bearer — the browser's JWT never leaves the browser↔module path — so
 * tenantMiddleware's Bearer rule would refuse every call with 401 (the "Data API authentication gap").
 *
 * Resolution, inside the existing design (CHATBOT-CENTRAL-SERVICE-PLAN §5.3 + MT Phase 2):
 *   • the identity token was minted by THIS module (`GET /assistant/token`) while the user's request
 *     ran under tenantMiddleware, so its `tenantDomain` is a COPY of the SAILERP-JWT-verified domain —
 *     a server value, signed with the module's own key, never a browser header;
 *   • the central service forwards that token UNMODIFIED, together with the shared service secret.
 * Both credentials are verified here; the tenant is the token's `tenantDomain`. A token without a
 * domain (minted on a single-tenant instance) is refused in multi-tenant mode — fail closed.
 *
 * `/assistant/manifest` serves the static tool definitions and touches no tenant data; it needs the
 * service secret only. This is NOT an exemption: nothing here runs without a verified credential.
 */
import type { Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { verifyIdentity } from './identityToken';

export type ServiceTenantDecision =
  | { kind: 'not-service' }                       // not an assistant service route → normal Bearer path
  | { kind: 'manifest' }                          // static tool list, secret verified, no tenant context needed
  | { kind: 'domain'; domain: string }            // execute: tenant = the module-signed identity's domain
  | { kind: 'reject'; status: number; error: string; message: string };

const SERVICE_PATHS = new Set(['/assistant/manifest', '/assistant/execute']);

function secretMatches(given: unknown): boolean {
  const expected = process.env.ASSISTANT_SERVICE_SECRET || '';
  if (!expected || typeof given !== 'string' || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assistantServiceTenant(req: Request): ServiceTenantDecision {
  if (!SERVICE_PATHS.has(req.path)) return { kind: 'not-service' };
  if (!secretMatches(req.headers['x-service-secret'])) {
    return { kind: 'reject', status: 401, error: 'unauthorized', message: 'service secret required' };
  }
  if (req.path === '/assistant/manifest') return { kind: 'manifest' };
  const v = verifyIdentity(req.headers['x-assistant-identity'], process.env.ASSISTANT_IDENTITY_SIGNING_KEY || '');
  if (!v.ok) return { kind: 'reject', status: 401, error: 'unauthorized', message: `identity rejected: ${v.reason}` };
  const domain = String(v.identity.tenantDomain || '').trim();
  if (!domain) {
    return {
      kind: 'reject',
      status: 401,
      error: 'invalid_identity',
      message: 'identity token carries no tenant domain (minted outside multi-tenant mode)',
    };
  }
  return { kind: 'domain', domain };
}
