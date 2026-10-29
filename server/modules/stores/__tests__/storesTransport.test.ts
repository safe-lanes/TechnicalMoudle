import { afterEach, it, expect, vi } from "vitest";
import { storesJson } from "../../../../client/src/pages/stores/storesTransport";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("explains existing server request-size rejection without retries", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("oversized", { status: 413 }));
  await expect(storesJson("/fixture", { version: 2, targets: [] })).rejects.toThrow("existing size limit");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("rejects an oversized serialized request before transport rather than truncating", async () => {
  vi.stubGlobal("Blob", class { size = 100 * 1024 * 1024 + 1; });
  const fetch = vi.spyOn(globalThis, "fetch");
  await expect(storesJson("/fixture", { targets: [] })).rejects.toThrow("Keep your pending edits");
  expect(fetch).not.toHaveBeenCalled();
});
it("passes cancellation and server messages through without automatic retry", async () => {
  const controller = new AbortController();
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "fixture denial" }), { status: 403 }));
  await expect(storesJson("/fixture", { version: 2 }, controller.signal)).rejects.toThrow("fixture denial");
  expect(fetch.mock.calls[0][1]?.signal).toBe(controller.signal);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each(["network", "gateway", "lost-response"])("reports uncertain write outcome after %s failure without retry", async failure => {
  const fetch = vi.spyOn(globalThis, "fetch");
  if (failure === "network") fetch.mockRejectedValue(new TypeError("Connection lost"));
  else fetch.mockResolvedValue(new Response(failure === "gateway" ? JSON.stringify({ error: "Gateway failed" }) : "incomplete", { status: failure === "gateway" ? 504 : 200 }));
  const draft = { version: 2, applied: [], overrides: [{ id: 1, data: { batchNumber: "keep" } }] };
  await expect(storesJson("/technical/api/stores/v1/chemicals/update", draft)).rejects.toThrow("may already have been applied");
  expect(draft.overrides[0].data.batchNumber).toBe("keep");
  expect(fetch).toHaveBeenCalledTimes(1);
});
