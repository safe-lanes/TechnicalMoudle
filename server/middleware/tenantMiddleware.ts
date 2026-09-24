import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tenantConnectionManager } from "../utils/tenantConnectionManager";
import { isExemptPath } from "./exemptPaths";
import { assistantServiceTenant } from "../modules/assistant-api/serviceTenant";

/**
 * Phase 2 — tenant resolution from the verified SAILERP `domain` claim.
 *
 * Mounted on /technical/api BEFORE mockAuthMiddleware. It verifies the forwarded
 * SAILERP Bearer (strict) ONLY to obtain the trustworthy `domain` for tenant-DB
 * routing, then runs the rest of the chain inside the tenant ALS context so
 * getDb()/getPool() resolve to the tenant database.
 *
 * It does NOT touch req.user / role / RBAC — identity stays with mockAuthMiddleware
 * exactly as today (role handling is out of Phase-2 scope; it already works in
 * deployment via the existing SAILERP-integrated path).
 *
 * SAFETY — byte-identical when off: returns next() immediately if multi-tenant is
 * disabled (MASTER_DATABASE_URL unset), or AUTH_BYPASS dev mode, or the path is
 * exempt (/sync/* server-to-server, health, instance-info). So local/dev and the
 * single-tenant deploy are unchanged; jsonwebtoken is never invoked when off.
 */

const IS_DEV = process.env.NODE_ENV === "development";
const AUTH_BYPASS = process.env.AUTH_BYPASS === "true" && IS_DEV;

function extractBearer(req: Request): string | null {
  const raw = req.headers["authorization"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const m = value.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** The user identity carried by the VERIFIED SAILERP token (never by browser headers). */
export interface VerifiedUser {
  userId: string | null;
  role: string | null;
  userType: "Office" | "Ship" | null;
  /** claim names that were looked up but absent/empty — a consumer can name them in its refusal */
  missing: string[];
}

const USER_CLAIM_NAMES = (() => {
  const raw = (process.env.SAILERP_JWT_USER_CLAIMS || "id,role,userType").split(",").map((s) => s.trim());
  return { userId: raw[0] || "id", role: raw[1] || "role", userType: raw[2] || "userType" };
})();

function claimString(payload: jwt.JwtPayload, name: string): string | null {
  const v = (payload as Record<string, unknown>)[name];
  if (typeof v === "number") return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function readVerifiedUser(payload: jwt.JwtPayload): VerifiedUser {
  const userId = claimString(payload, USER_CLAIM_NAMES.userId);
  const role = claimString(payload, USER_CLAIM_NAMES.role);
  const ut = claimString(payload, USER_CLAIM_NAMES.userType);
  const userType: VerifiedUser["userType"] = ut === "Office" || ut === "Ship" ? ut : null;
  const missing: string[] = [];
  if (!userId) missing.push(USER_CLAIM_NAMES.userId);
  if (!role) missing.push(USER_CLAIM_NAMES.role);
  if (!userType) missing.push(USER_CLAIM_NAMES.userType);
  return { userId, role, userType, missing };
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Inert unless multi-tenant mode is on — preserves today's single-tenant path exactly.
  if (!tenantConnectionManager.isMultiTenantEnabled) return next();
  // Dev-only escape hatch (no SAILERP token locally).
  if (AUTH_BYPASS) return next();
  // Server-to-server / public routes that legitimately carry no SAILERP browser token.
  if (isExemptPath(req.path)) return next();

  // Assistant Data API, server-to-server (central assistant → this module): that hop carries no SAILERP
  // Bearer. Its tenant is the module's OWN signed identity token's tenantDomain (copied from the verified
  // JWT at mint time), accepted only together with the shared service secret — two verified credentials,
  // no exemption, no browser header trusted. Everything else keeps the Bearer rule below. (23-Sep-2026)
  let domain = "";
  const svc = assistantServiceTenant(req);
  if (svc.kind === "reject") {
    res.status(svc.status).json({ error: svc.error, message: svc.message });
    return;
  }
  if (svc.kind === "manifest") return next(); // static tool definitions — touches no tenant data
  if (svc.kind === "domain") {
    domain = svc.domain;
  } else {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Defensive — boot already fails loud if this is missing in multi-tenant mode.
      res.status(500).json({ error: "server_misconfigured", message: "JWT_SECRET not set in multi-tenant mode" });
      return;
    }

    const token = extractBearer(req);
    if (!token) {
      res.status(401).json({ error: "unauthorized", message: "Missing authorization token" });
      return;
    }

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    } catch (err: any) {
      if (err && err.name === "TokenExpiredError") {
        res.status(401).json({ error: "token_expired", message: "Authorization token has expired" });
        return;
      }
      res.status(401).json({ error: "invalid_token", message: "Invalid authorization token" });
      return;
    }

    domain = typeof payload === "object" && typeof payload.domain === "string" ? payload.domain.trim() : "";
    if (!domain) {
      res.status(401).json({ error: "invalid_token", message: "Token is missing the domain claim" });
      return;
    }
    // Option A (24-Sep-2026, pilot): expose the VERIFIED user claims of the same token — user id, role, user
    // type — for consumers that must not trust the browser's x-user-* headers (the assistant token mint).
    // Claim names default to the SAILERP shape and are configurable (SAILERP_JWT_USER_CLAIMS="id,role,userType")
    // so the genuine-session inspection can correct them without code. Nothing is rejected HERE — every
    // other route keeps its existing identity handling; a consumer decides whether missing claims are fatal.
    (req as any).verifiedUser = readVerifiedUser(payload as jwt.JwtPayload);
  }

  // Expose the verified domain on req so downstream handlers that need it (e.g.
  // provisioning writing the onboarding tenant_instances map row) can read it
  // without re-verifying. Identity/role still stay with mockAuthMiddleware.
  (req as any).tenantDomain = domain;

  tenantConnectionManager
    .resolveTenant(domain)
    .then((tenant) =>
      // Keep the ALS context open for the whole request (mirrors Crewing): the rest of
      // the chain — mockAuthMiddleware, requestContext, moduleRouter, handlers — runs
      // inside runInTenantContext, so getDb()/getPool() hit the tenant DB.
      tenantConnectionManager.runInTenantContext(
        tenant.tuid,
        () =>
          new Promise<void>((resolve, reject) => {
            res.on("finish", resolve);
            res.on("close", resolve);
            res.on("error", reject);
            // Stash the resolved tuid on req (a plain property, set before next() and
            // thus before any route-level multer). It survives body-parsers that break
            // the ALS chain (multer/busboy consume the request stream on the socket's
            // pre-context async resource), so multipart handlers can re-enter the tenant
            // context via captureTenantFromReq(req).
            (req as any).tenantTuid = tenant.tuid;
            next();
          }),
      ),
    )
    .catch((err: any) => {
      if (res.headersSent) return;
      switch (err?.name) {
        case "TenantNotFoundError":
          res.status(403).json({ error: "invalid_tenant", message: err.message });
          return;
        case "TenantInactiveError":
          res.status(403).json({ error: "tenant_inactive", message: err.message });
          return;
        default:
          res.status(503).json({ error: "tenant_unavailable", message: "Tenant database unavailable" });
      }
    });
}
