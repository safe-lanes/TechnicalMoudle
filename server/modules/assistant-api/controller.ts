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
 * Mint (GET /assistant/token): converts the module's own resolved session into a
 * signed identity for the widget to attach to central-service calls. The role
 * comes from req.rbac — the REAL forwarded SAILERP role — NEVER the mock
 * req.user.role, and an rbac source of "none" is REFUSED (403), not defaulted:
 * a token minted from the mock would launder its over-permission behind a valid
 * signature (auth.ts mock-identity backlog).
 *
 * R3: tool denials/failures are DATA ({ok:false, error}) with HTTP 200 so the
 * LLM can relay them politely; non-200 is reserved for transport/auth failures.
 */
import { Response } from 'express';
import { type AuthenticatedRequest, getRbacIdentity } from '../../middleware/auth';
import { CHATBOT_TOOLS, executeTool, type VesselAccess } from '../../services/chatbotService';
import { storage } from '../../storage';
import { signIdentity, verifyIdentity } from './identityToken';

const API_VERSION = 1;
const MODULE_ID = 'technical';

const serviceSecret = () => process.env.ASSISTANT_SERVICE_SECRET || '';
const signingKey = () => process.env.ASSISTANT_IDENTITY_SIGNING_KEY || '';

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
export async function handleMintToken(req: AuthenticatedRequest, res: Response) {
  const rbac = getRbacIdentity(req);
  if (rbac.source === 'none' || !rbac.role) {
    return res.status(403).json({
      error: 'cannot mint: no real forwarded identity on this session (rbac source is none) — refusing to sign the mock fallback',
    });
  }
  const key = signingKey();
  if (!key) return res.status(503).json({ error: 'assistant identity signing not configured' });
  // 23-Sep-2026 (pilot): req.user.id is the MOCK session (always 1), so every user minted userId '1' —
  // one shared central rate-limit bucket and useless audit lines. For a forwarded session the user id
  // is the forwarded x-user-id (auth.ts stores it on req.user.userUuid) — the same trust level as the
  // role and userType beside it (client-forwarded SAILERP identity, NOT server-verified; identical to
  // what the module's own RBAC guards trust). The mock id remains only for the mock source.
  const userId = String(
    (rbac.source === 'forwarded' && (req as any).user?.userUuid) ||
      (req as any).user?.id ||
      (req as any).user?.username ||
      '',
  );
  if (!userId) return res.status(403).json({ error: 'cannot mint: no user id on session' });
  const token = signIdentity(
    {
      userId,
      userName: req.user?.fullName,
      role: rbac.role, // the REAL forwarded role — never the mock req.user.role
      userType: rbac.userType ?? null, // 'Office' | 'Ship' — the vessel-scope decision key (23-Sep-2026)
      vesselId: (req as any).user?.vesselId ?? null,
      tenantDomain: (req as any).tenantDomain ?? null,
      tuid: (req as any).tenantTuid ?? null,
    },
    key,
    60,
  );
  res.json({ token, expiresInSec: 60 });
}
