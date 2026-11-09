import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDevelopmentUser } from "@shared/developmentUser";

const fixture = vi.hoisted(() => ({
  token: null as string | null,
  requests: [] as Array<{ url: string; headers: Headers }>,
}));

vi.mock("@/lib/authToken", () => ({ getAccessToken: () => fixture.token }));

import { installRankFetchInterceptor, setActiveIdentity } from "@/lib/activeRank";

const defaultUser = createDefaultDevelopmentUser();
const nativeFetch = globalThis.fetch;

beforeAll(() => {
  const browser = {
    location: { origin: "http://forms-master.test" },
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      fixture.requests.push({ url, headers: new Headers(init?.headers) });
      return new Response("{}", { status: 200 });
    }) as typeof fetch,
  };
  vi.stubGlobal("window", browser);
  installRankFetchInterceptor();
});

beforeEach(() => {
  fixture.requests.length = 0;
  vi.stubEnv("VITE_APP_ENV", "replit");
  fixture.token = "stale-or-unrelated-session";
  setActiveIdentity({
    userId: defaultUser.userUuid,
    role: defaultUser.role,
    userType: defaultUser.userType,
  });
});

afterAll(() => {
  setActiveIdentity(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Forms Master development identity transport", () => {
  it("selects the AuthContext default only for Forms Master requests in Replit and omits stale bearer auth", async () => {
    await window.fetch("/technical/api/admin/forms-master/options", {
      headers: { Authorization: "Bearer explicitly-stale" },
    });
    const request = fixture.requests.at(-1)!;
    expect(request.headers.get("x-forms-master-development")).toBe("default-user");
    expect(request.headers.get("x-user-id")).toBe(defaultUser.userUuid);
    expect(request.headers.get("x-user-role")).toBe(encodeURIComponent(defaultUser.role));
    expect(request.headers.get("authorization")).toBeNull();
  });

  it("does not select the default identity for other APIs", async () => {
    await window.fetch("/technical/api/work-orders", {
      headers: { Authorization: "Bearer real-session" },
    });
    const request = fixture.requests.at(-1)!;
    expect(request.headers.get("x-forms-master-development")).toBeNull();
    expect(request.headers.get("authorization")).toBe("Bearer real-session");
  });

  it.each(["", "production", "Replit"])("keeps ordinary bearer authentication when VITE_APP_ENV is %s", async env => {
    vi.stubEnv("VITE_APP_ENV", env);
    await window.fetch("/technical/api/admin/forms-master/options", {
      headers: { Authorization: "Bearer real-session" },
    });
    const request = fixture.requests.at(-1)!;
    expect(request.headers.get("x-forms-master-development")).toBeNull();
    expect(request.headers.get("authorization")).toBe("Bearer real-session");
  });

  it("does not add the default marker after AuthContext clears identity on logout", async () => {
    setActiveIdentity(null);
    await window.fetch("/technical/api/admin/forms-master/options");
    const request = fixture.requests.at(-1)!;
    expect(request.headers.get("x-forms-master-development")).toBeNull();
  });

  it("clears a caller-provided marker when the current identity is not the fixed default", async () => {
    setActiveIdentity({ userId: "8eb5b00d-55cb-4c0f-8b62-000000000177", role: "Fleet Manager", userType: "Office" });
    await window.fetch("/technical/api/admin/forms-master/options", {
      headers: { "x-forms-master-development": "default-user", Authorization: "Bearer real-session" },
    });
    const request = fixture.requests.at(-1)!;
    expect(request.headers.get("x-forms-master-development")).toBeNull();
    expect(request.headers.get("authorization")).toBe("Bearer real-session");
  });
});
