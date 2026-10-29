import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultDevelopmentUser } from "@shared/developmentUser";

const state = vi.hoisted(() => ({ replit: true, loggedOut: false, api: vi.fn() }));
vi.mock("@/lib/env", () => ({ isReplit: () => state.replit }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: state.api }));
vi.mock("@/utils/secureStorage", () => ({ hasLoggedOutMarker: () => state.loggedOut }));
import { sectionHRequest } from "@/lib/sectionHRequest";

const user = createDefaultDevelopmentUser();
const url = "/technical/api/component-class-regulatory/component/access";
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); state.replit = true; state.loggedOut = false; });
describe("Section H scoped request transport", () => {
  it("sends the selected default actor explicitly in Replit", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await sectionHRequest(user, "GET", url);
    expect(fetcher).toHaveBeenCalledWith(url, expect.objectContaining({
      credentials: "include", headers: expect.objectContaining({
        "x-section-h-development": "default-user", "x-user-id": user.userUuid,
        "x-user-role": encodeURIComponent(user.role), "x-user-type": "Office",
      }),
    }));
    expect(state.api).not.toHaveBeenCalled();
  });
  it("keeps the existing production credentials transport unchanged", async () => {
    state.replit = false;
    await sectionHRequest(user, "POST", url, { information: "test" });
    expect(state.api).toHaveBeenCalledWith("POST", url, { information: "test" });
  });
  it("makes no request after logout or without a current user", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(sectionHRequest(null, "GET", url)).rejects.toThrow("sign in");
    state.loggedOut = true;
    await expect(sectionHRequest(user, "POST", url)).rejects.toThrow("sign in");
    expect(fetcher).not.toHaveBeenCalled(); expect(state.api).not.toHaveBeenCalled();
  });
  it("does not apply default-user request headers to other endpoints", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(sectionHRequest(user, "GET", "/technical/api/users")).rejects.toThrow("cannot be used");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves useful server errors rather than silently accepting a refused save", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"Rollout pending"}', { status: 409 })));
    await expect(sectionHRequest(user, "POST", url, {})).rejects.toThrow("409");
  });
});
