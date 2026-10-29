import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { createDefaultDevelopmentUser } from "@shared/developmentUser";

const fixture = vi.hoisted(() => ({ token: null as string | null, requests: [] as any[] }));
vi.mock("@/lib/authToken", () => ({ getAccessToken: () => fixture.token }));
vi.mock("@/utils/secureStorage", () => ({ hasLoggedOutMarker: () => false }));
vi.mock("../../../db", () => ({ getDb: vi.fn() }));
vi.mock("../../../storage", () => ({ storage: {} }));
vi.mock("../../../utils/tenantConnectionManager", () => ({
  tenantConnectionManager: { isMultiTenantEnabled: false },
}));
vi.mock("../../assistant-api/masterUserRepository", () => ({
  findMasterUserById: async () => ({ role: "Sail Admin", userType: "Office" }),
}));
import { sectionHRequest } from "@/lib/sectionHRequest";
import { installRankFetchInterceptor, setActiveIdentity } from "@/lib/activeRank";
import { requireSectionHIdentity, requireSectionHOffice } from "../services/classRegulatoryAccess";
import { readVerifiedUser } from "../../../middleware/tenantMiddleware";

const user = createDefaultDevelopmentUser();
const otherUser = "8eb5b00d-55cb-4c0f-8b62-000000000177";
const secret = "isolated-http-fixture-key";
const path = "/technical/api/component-class-regulatory";
let server: Server, root: string;
const nativeFetch = globalThis.fetch;

describe("Section H real client/interceptor/server request with a valid non-default stored token", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      fixture.requests.push({ authorization: req.headers.authorization, path: req.path });
      req.user = { userUuid: user.userUuid };
      req.rbac = { source: "none" };
      // Model an upstream verifier too: a genuinely established Ship session
      // must never be upgraded through the default-user selector.
      if (req.headers.authorization) {
        req.verifiedUser = readVerifiedUser(jwt.verify(req.headers.authorization.slice(7), secret) as jwt.JwtPayload);
      }
      next();
    });
    app.post(path, requireSectionHIdentity, requireSectionHOffice, (req: any, res) => res.status(201).json(req.sectionHActor));
    app.get("/technical/api/other-module", (req, res) => res.json({ authorization: req.headers.authorization }));
    server = await new Promise<Server>(resolve => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    root = `http://127.0.0.1:${(server.address() as any).port}`;
    // Install the REAL browser interceptor, routing its underlying fetch into
    // the real isolated HTTP server. No production/shared-app token is minted.
    const browser = {
      location: { origin: root },
      fetch: (input: any, init?: RequestInit) => nativeFetch(
        typeof input === "string" && input.startsWith("/") ? root + input : input, init),
    };
    vi.stubGlobal("window", browser);
    installRankFetchInterceptor();
    vi.stubGlobal("fetch", browser.fetch);
  });
  beforeEach(() => {
    fixture.requests.length = 0;
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VITE_APP_ENV", "replit");
    fixture.token = jwt.sign({ id: otherUser, role: "Vessel User", userType: "Ship" }, secret, { expiresIn: "1m" });
    setActiveIdentity({ userId: otherUser, role: "Vessel User", userType: "Ship" });
  });
  afterAll(async () => {
    setActiveIdentity(null);
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  it("does not forward the valid stored Bearer into an explicit Replit default-user request", async () => {
    expect((jwt.verify(fixture.token!, secret) as any).id).toBe(otherUser);
    const response = await sectionHRequest(user, "POST", path, {});
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ userId: user.userUuid, identityMode: "replit-default" });
    expect(fixture.requests[0].authorization).toBeUndefined();
  });
  it("also removes an explicitly supplied stale token on the scoped default-user transport", async () => {
    const response = await fetch(path, {
      method: "POST", headers: { Authorization: `Bearer ${fixture.token}`,
        "x-section-h-development": "default-user", "x-user-id": user.userUuid!,
        "x-user-role": user.role, "x-user-type": "Office" },
    });
    expect(response.status).toBe(201);
    expect(fixture.requests[0].authorization).toBeUndefined();
  });
  it("retains the valid stored token for all other module requests", async () => {
    const response = await fetch("/technical/api/other-module");
    expect((await response.json()).authorization).toBe(`Bearer ${fixture.token}`);
  });
  it("does not strip or upgrade a real Ship session outside Replit", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VITE_APP_ENV", "");
    const response = await fetch(path, { method: "POST", headers: {
      "x-section-h-development": "default-user", "x-user-id": user.userUuid!,
      "x-user-role": user.role, "x-user-type": "Office",
    } });
    expect(response.status).toBe(403);
    expect(fixture.requests[0].authorization).toBe(`Bearer ${fixture.token}`);
  });
});
