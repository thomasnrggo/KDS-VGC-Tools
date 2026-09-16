import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createKeyedDebouncer } from "./keyedDebounce";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createKeyedDebouncer", () => {
  it("collapses a burst of same-key calls into a single run after the delay", () => {
    const debouncer = createKeyedDebouncer(1000);
    const run = vi.fn();

    debouncer.schedule("a", run);
    vi.advanceTimersByTime(400);
    debouncer.schedule("a", run);
    vi.advanceTimersByTime(400);
    debouncer.schedule("a", run);
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("only runs the most recently scheduled callback for a key", () => {
    const debouncer = createKeyedDebouncer(1000);
    const first = vi.fn();
    const second = vi.fn();

    debouncer.schedule("a", first);
    debouncer.schedule("a", second);
    vi.advanceTimersByTime(1000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("keeps independent keys on independent timers", () => {
    const debouncer = createKeyedDebouncer(1000);
    const runA = vi.fn();
    const runB = vi.fn();

    debouncer.schedule("a", runA);
    vi.advanceTimersByTime(600);
    debouncer.schedule("b", runB);
    vi.advanceTimersByTime(400);

    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).not.toHaveBeenCalled();

    vi.advanceTimersByTime(600);
    expect(runB).toHaveBeenCalledTimes(1);
  });

  it("cancel drops a pending call without running it", () => {
    const debouncer = createKeyedDebouncer(1000);
    const run = vi.fn();

    debouncer.schedule("a", run);
    debouncer.cancel("a");
    vi.advanceTimersByTime(1000);

    expect(run).not.toHaveBeenCalled();
  });

  it("cancel on a key with nothing pending is a no-op", () => {
    const debouncer = createKeyedDebouncer(1000);
    expect(() => debouncer.cancel("nonexistent")).not.toThrow();
  });
});
