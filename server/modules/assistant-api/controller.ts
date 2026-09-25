/**
 * Assistant Data API — Technical module's reference implementation of
 * CHATBOT-CENTRAL-SERVICE-PLAN.md §5 (Stage 3 of the implementation plan).
 *
 * REPACKAGING, NOT REBUILDING: the manifest serves the existing CHATBOT_TOOLS
 * definitions and execute dispatches to the existing executeTool — the exact
 * function (and therefore the exact scope enforcement, §3.5) the embedded
 * chatbot runs. The embedded /chat path is untouched.
 *
 * Auth (§5.3, two layers, both required):
 *   1. x-service-secret — only the central service may call this API.
 *   2. x-assistant-identity — the SIGNED forwarded identity; unsigned/tampered/
 *      expired/future-dated are rejected even with a valid secret.
 *
 * Mint (GET /assistant/token): converts the VERIFIED SAILERP login into a signed
 * identity for the widget to attach to central-service calls. Option A (24-Sep-2026):
 * user id, role and user type are read from the JWT-verified claims that
 * tenantMiddleware exposes as req.verifiedUser — never from the browser's x-user-*
 * headers, req.rbac or the mock req.user. Missing claims → 403 (no header fallback);
 * a role outside ASSISTANT_ALLOWED_ROLES (default 'Sail Admin') → 403; an instance
 * that verifies no token (single-tenant, AUTH_BYPASS) cannot mint at all.
 *
 * R3: tool denials/failures are DATA ({ok:false, error}) with HTTP 200 so the
 * LLM can relay them politely; non-200 is reserved for transport/auth failures.
 */
import { Response } from 'express';
import { type AuthenticatedRequest } from '../../middleware/auth';
import type { VerifiedUser } from '../../middleware/tenantMiddleware';
import { findMasterUserById } from './masterUserRepository';

/** The role claim name as configured for the login token (SAILERP_JWT_USER_CLAIMS = "id,role,userType"). */
const ROLE_CLAIM = ((process.env.SAILERP_JWT_USER_CLAIMS || 'id,role,userType').split(',')[1] || 'role').trim();
import { CHATBOT_TOOLS, executeTool, type VesselAccess } from '../../services/chatbotService';
import { storage } from '../../storage';
import { signIdentity, verifyIdentity } from './identityToken';

const API_VERSION = 1;
const MODULE_ID = 'technical';

const serviceSecret = () => process.env.ASSISTANT_SERVICE_SECRET || '';
const signingKey = () => process.env.ASSISTANT_IDENTITY_SIGNING_KEY || '';
/** This module INSTANCE's id as registered on the central assistant (e.g. 'technical-dev', 'technical-prod').
 *  24-Sep-2026: the token carries it as `iss`; the assistant verifies with the key registered for that id and
 *  calls back ONLY that id's registered URL with that id's secret, so dev and production share one assistant
 *  without ever crossing. Required for the assistant to be usable at all from this instance. */
const instanceId = () => (process.env.ASSISTANT_INSTANCE_ID || '').trim();

function requireServiceSecret(req: AuthenticatedRequest, res: Response): boolean {
  const secret = serviceSecret();
  if (!secret || req.headers['x-service-secret'] !== secret) {
    res.status(401).json({ error: 'service secret required' });
    return false;
  }
  return true;
}

export async function handleManifest(req: AuthenticatedRequest, res: Response) {
  if (!requireServiceSecret(req, res)) return;
  res.json({
    apiVersion: API_VERSION,
    module: MODULE_ID,
    tools: CHATBOT_TOOLS.flatMap((t) => ('function' in t ? [t.function] : [])),
  });
}

export async function handleExecute(req: AuthenticatedRequest, res: Response) {
  if (!requireServiceSecret(req, res)) return;
  const v = verifyIdentity(req.headers['x-assistant-identity'], signingKey());
  if (!v.ok) return res.status(401).json({ error: `identity rejected: ${v.reason}` });
  // 24-Sep-2026: accept only tokens THIS instance minted — a token from another environment is refused even if
  // a signing key were ever shared by mistake.
  if (instanceId() && v.identity.iss !== instanceId()) {
    return res.status(401).json({ error: `identity rejected: issuer '${v.identity.iss ?? ''}' is not this instance` });
  }

  const { tool, args, requestId } = (req.body || {}) as { tool?: string; args?: any; requestId?: string };
  if (!tool || typeof tool !== 'string') return res.status(400).json({ error: 'tool is required' });
  if (!CHATBOT_TOOLS.some((t) => 'function' in t && t.function.name === tool)) {
    return res.json({ ok: false, error: `Unknown tool '${tool}' for module ${MODULE_ID}` });
  }

  // 23-Sep-2026 (pilot): executeTool's vessel-scope rule speaks the LEGACY role vocabulary
  // ('Office' = any vessel, 'Ship' = assigned vessel only, plus the two admin names), but the token
  // carries the SAILERP role NAME ('Admin', 'User', 'Vessel User', …), so every office user except
  // 'Sail Admin' was refused on every vessel. Decide by the forwarded user TYPE, which is what the
  // module's own guards use (auth.ts rbac.userType); fall back to the role name when the type is
  // absent (older tokens). A Ship user with no assigned vessel on the session stays refused.
  const ut = v.identity.userType ?? undefined;
  const scopeRole = ut === 'Ship' ? 'Ship' : ut === 'Office' ? 'Office' : v.identity.role;
  const access: VesselAccess = { role: scopeRole, vesselId: v.identity.vesselId ?? null };
  // Audit line: the ACTUAL tool arguments the central service sent (no answer text, no secrets).
  console.log(`[assistant-api] execute ${tool} args=${JSON.stringify(args || {}).slice(0, 300)} user=${v.identity.userId} role=${v.identity.role} req=${requestId ?? '-'}`);
  try {
    const data = await executeTool(tool, args || {}, storage, access);
    if (data && typeof data === 'object' && 'error' in data && Object.keys(data).length === 1) {
      return res.json({ ok: false, error: String((data as any).error), requestId });
    }
    return res.json({ ok: true, data, requestId });
  } catch (e: any) {
    return res.json({ ok: false, error: e?.message || 'tool execution failed', requestId });
  }
}

/** Mint a signed identity from the module's REAL resolved session (see header). */
/** Roles allowed to obtain an assistant token — server-enforced on the VERIFIED role (24-Sep-2026). */
const allowedRoles = () =>
  (process.env.ASSISTANT_ALLOWED_ROLES || 'Sail Admin').split(',').map((s) => s.trim()).filter(Boolean);

export async function handleMintToken(req: AuthenticatedRequest, res: Response) {
  const key = signingKey();
  if (!key) return res.status(503).json({ error: 'assistant identity signing not configured' });
  if (!instanceId()) return res.status(503).json({ error: 'assistant instance id not configured (ASSISTANT_INSTANCE_ID)' });
  // Option A (24-Sep-2026, pilot): the token's user id, role and user type come ONLY from the VERIFIED
  // SAILERP login token (tenantMiddleware → req.verifiedUser). Browser headers (x-user-*), the mock
  // session and req.rbac are NOT consulted — missing claims are refused, never filled from headers.
  // Single-tenant / AUTH_BYPASS instances verify no token and therefore cannot mint (fail closed).
  const vu = (req as any).verifiedUser as VerifiedUser | undefined;
  if (!vu) {
    return res.status(403).json({
      error: 'cannot mint: no verified login identity on this request (multi-tenant mode with a SAILERP token is required)',
    });
  }
  // Option B (25-Sep-2026, PROVEN on dev): the genuine SAILERP token carries `id` and `userType` but no `role`.
  // The role is then resolved SERVER-SIDE from the tenant's synced SAILERP master data (master_users) by the
  // verified user id — never from the browser's x-user-role header. A user absent from master data cannot mint.
  const hardMissing = vu.missing.filter((c) => c !== ROLE_CLAIM);
  if (hardMissing.length) {
    return res.status(403).json({
      error: `cannot mint: the login token is missing required claim(s): ${hardMissing.join(', ')}`,
    });
  }
  let role = vu.role;
  let roleSource: 'token' | 'master_users' = 'token';
  if (!role) {
    const mu = await findMasterUserById(vu.userId!);
    if (!mu || !mu.role) {
      return res.status(403).json({
        error: `cannot mint: the login token carries no role and user '${vu.userId}' has no role in the synced master data (master_users)`,
      });
    }
    role = mu.role;
    roleSource = 'master_users';
  }
  if (!allowedRoles().includes(role)) {
    return res.status(403).json({ error: `cannot mint: role '${role}' is not permitted to use the assistant` });
  }
  console.log(`[assistant-api] mint user=${vu.userId} role=${role} (${roleSource}) userType=${vu.userType} iss=${instanceId()}`);
  const token = signIdentity(
    {
      userId: vu.userId!,
      userName: req.user?.fullName, // display/masking only (from the profile) — never used for authorisation
      role, // VERIFIED: token claim, or the synced master-data role for the verified user id
      userType: vu.userType, // VERIFIED token claim — the vessel-scope decision key
      vesselId: (req as any).user?.vesselId ?? null,
      tenantDomain: (req as any).tenantDomain ?? null,
      tuid: (req as any).tenantTuid ?? null,
      iss: instanceId(), // which registered instance minted this — the assistant's routing key

    },
    key,
    60,
  );
  res.json({ token, expiresInSec: 60 });
}
