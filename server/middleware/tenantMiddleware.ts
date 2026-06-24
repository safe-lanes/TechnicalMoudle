import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tenantConnectionManager } from "../utils/tenantConnectionManager";
import { isExemptPath } from "./exemptPaths";

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

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Inert unless multi-tenant mode is on — preserves today's single-tenant path exactly.
  if (!tenantConnectionManager.isMultiTenantEnabled) return next();
  // Dev-only escape hatch (no SAILERP token locally).
  if (AUTH_BYPASS) return next();
  // Server-to-server / public routes that legitimately carry no SAILERP browser token.
  if (isExemptPath(req.path)) return next();

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

  const domain =
    typeof payload === "object" && typeof payload.domain === "string" ? payload.domain.trim() : "";
  if (!domain) {
    res.status(401).json({ error: "invalid_token", message: "Token is missing the domain claim" });
    return;
  }

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
