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

  // Same access object shape the embedded bot builds (chatbotController.ts) — the
  // scope decision inside executeTool is therefore byte-identical on both paths.
  const access: VesselAccess = { role: v.identity.role, vesselId: v.identity.vesselId ?? null };
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
  const userId = String((req as any).user?.id || (req as any).user?.username || '');
  if (!userId) return res.status(403).json({ error: 'cannot mint: no user id on session' });
  const token = signIdentity(
    {
      userId,
      userName: req.user?.fullName,
      role: rbac.role, // the REAL forwarded role — never the mock req.user.role
      vesselId: (req as any).user?.vesselId ?? null,
      tenantDomain: (req as any).tenantDomain ?? null,
      tuid: (req as any).tenantTuid ?? null,
    },
    key,
    60,
  );
  res.json({ token, expiresInSec: 60 });
}
