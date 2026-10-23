import { describe, expect, it, vi } from "vitest";
import { batchProcess, batchProcessWithSSE, isRateLimitError } from "../utils";

const noDelay = { minTimeout: 0, maxTimeout: 0 };

describe("batch dependency API regression", () => {
  it.each(["429 Too many requests", "RATELIMIT_EXCEEDED", "QUOTA exceeded", "Rate Limit reached"])(
    "retries recognized rate limits in both modes: %s", async message => {
      expect(isRateLimitError(new Error(message))).toBe(true);
      for (const sse of [false, true]) {
        const processor = vi.fn()
          .mockRejectedValueOnce(new Error(message))
          .mockResolvedValue("done");
        const result = sse
          ? await batchProcessWithSSE(["item"], processor, vi.fn(), { ...noDelay, retries: 1 })
          : await batchProcess(["item"], processor, { ...noDelay, retries: 1 });
        expect(result).toEqual(["done"]);
        expect(processor).toHaveBeenCalledTimes(2);
        expect(processor).toHaveBeenNthCalledWith(1, "item", 0);
        expect(processor).toHaveBeenNthCalledWith(2, "item", 0);
      }
    },
  );

  it("keeps the default retry budgets (8 batch attempts, 6 SSE attempts)", async () => {
    const error = new Error("429 exhausted");
    const batch = vi.fn().mockRejectedValue(error);
    await expect(batchProcess([1], batch, noDelay)).rejects.toBe(error);
    expect(batch).toHaveBeenCalledTimes(8);
    const sequential = vi.fn().mockRejectedValue(error);
    const events = vi.fn();
    expect(await batchProcessWithSSE([1], sequential, events, noDelay)).toEqual([undefined]);
    expect(sequential).toHaveBeenCalledTimes(6);
    expect(events.mock.calls.map(([event]) => event)).toEqual([
      { type: "started", total: 1 },
      { type: "processing", index: 0, item: 1 },
      { type: "progress", index: 0, error: "429 exhausted" },
      { type: "complete", processed: 1, errors: 1 },
    ]);
  });

  it.each([new Error("ordinary failure"), "ordinary failure"])(
    "aborts ordinary batch errors on the first attempt, retaining the message", async error => {
      const processor = vi.fn().mockRejectedValue(error);
      const onProgress = vi.fn();
      await expect(batchProcess([1], processor, { ...noDelay, onProgress }))
        .rejects.toThrow("ordinary failure");
      expect(processor).toHaveBeenCalledTimes(1);
      expect(onProgress).not.toHaveBeenCalled();
    },
  );

  it("preserves input ordering, concurrency and success-only progress", async () => {
    let active = 0;
    let maximum = 0;
    const progress = vi.fn();
    const result = await batchProcess([0, 1, 2], async (item, index) => {
      expect(index).toBe(item);
      maximum = Math.max(maximum, ++active);
      await new Promise(resolve => setTimeout(resolve, item === 0 ? 10 : 0));
      active--;
      return `result-${item}`;
    }, { ...noDelay, concurrency: 2, onProgress: progress });
    expect(result).toEqual(["result-0", "result-1", "result-2"]);
    expect(maximum).toBe(2);
    expect(progress.mock.calls).toEqual([[1, 3, 1], [2, 3, 2], [3, 3, 0]]);
  });

  it("SSE reports ordinary and exhausted failures, retries rate limits and continues in order", async () => {
    const counts = [0, 0, 0, 0];
    const events: unknown[] = [];
    const result = await batchProcessWithSSE(
      ["bad", "retry", "exhaust", "good"],
      async (item, index) => {
        counts[index]++;
        if (item === "bad") throw new Error("original ordinary message");
        if (item === "exhaust" || (item === "retry" && counts[index] === 1)) {
          throw new Error("quota exhausted");
        }
        return item.toUpperCase();
      },
      event => events.push(event),
      { ...noDelay, retries: 2 },
    );
    expect(counts).toEqual([1, 2, 3, 1]);
    expect(result).toEqual([undefined, "RETRY", undefined, "GOOD"]);
    expect(events).toEqual([
      { type: "started", total: 4 },
      { type: "processing", index: 0, item: "bad" },
      { type: "progress", index: 0, error: "original ordinary message" },
      { type: "processing", index: 1, item: "retry" },
      { type: "progress", index: 1, result: "RETRY" },
      { type: "processing", index: 2, item: "exhaust" },
      { type: "progress", index: 2, error: "quota exhausted" },
      { type: "processing", index: 3, item: "good" },
      { type: "progress", index: 3, result: "GOOD" },
      { type: "complete", processed: 4, errors: 2 },
    ]);
  });

  it("does not cancel concurrent siblings when Promise.all rejects", async () => {
    let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const progress = vi.fn();
    const result = batchProcess(["bad", "sibling"], async item => {
      if (item === "bad") throw new Error("stop");
      await gate;
      return "sibling finished";
    }, { ...noDelay, onProgress: progress });
    await expect(result).rejects.toThrow("stop");
    finish();
    await vi.waitFor(() => expect(progress).toHaveBeenCalledWith(1, 2, "sibling"));
  });

  it("preserves empty-input results and SSE events", async () => {
    const processor = vi.fn();
    const events = vi.fn();
    expect(await batchProcess([], processor)).toEqual([]);
    expect(await batchProcessWithSSE([], processor, events)).toEqual([]);
    expect(processor).not.toHaveBeenCalled();
    expect(events.mock.calls.map(([event]) => event)).toEqual([
      { type: "started", total: 0 }, { type: "complete", processed: 0, errors: 0 },
    ]);
  });
});
