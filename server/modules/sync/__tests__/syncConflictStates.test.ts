import { describe, expect, it } from "vitest";
import { countState, resultState, reviewEmptyTitle } from "../../../../client/src/pages/admin/syncConflictStates";

describe("ship and shore conflict result states", () => {
  const ready = { isError: false, isSuccess: true, isFetching: false };
  it("accepts a successful empty result, with different empty titles for each filter", () => {
    expect(resultState(ready)).toBe("ready");
    expect(reviewEmptyTitle("unresolved")).toBe("No unresolved conflicts");
    expect(reviewEmptyTitle("resolved")).toBe("No resolved conflicts");
  });
  it.each([403, 500])("shows an error rather than empty results for HTTP %i", status => {
    // A rejected fetch (including the tables filter fetch) sets the query error state.
    const failed = { ...ready, isError: true, error: new Error(String(status)) };
    expect(resultState(failed)).toBe("error");
    expect(countState("ship-1", failed)).toBe("error");
  });
  it("does not mistake a pending request or stale cached response for zero", () => {
    expect(resultState({ isError: false, isSuccess: false, isFetching: true })).toBe("loading");
    expect(resultState({ ...ready, isFetching: true })).toBe("loading");
    expect(resultState({ ...ready, isError: true })).toBe("error");
    expect(countState("ship-1", { ...ready, isFetching: true })).toBe("loading");
    expect(countState("", ready)).toBe("select-vessel");
    expect(countState("ship-1", ready)).toBe("ready");
  });
});