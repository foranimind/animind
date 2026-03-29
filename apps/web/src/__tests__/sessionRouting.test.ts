import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveSessionHref } from "../lib/sessionRouting";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { getSessionDetail, saveSessionDetail } from "../lib/storage";

describe("resolveSessionHref", () => {
  it.each([
    [{ status: "draft" as const, jobId: undefined }, "/"],
    [{ status: "queued" as const, jobId: "job-123" }, "/jobs/job-123"],
    [{ status: "running" as const, jobId: "job/123?foo=bar" }, "/jobs/job%2F123%3Ffoo%3Dbar"],
    [{ status: "done" as const, jobId: "job-456" }, "/works/job-456"],
    [{ status: "done" as const, jobId: "work/456?foo=bar" }, "/works/work%2F456%3Ffoo%3Dbar"],
  ])("maps %o to %s", (input, expected) => {
    expect(resolveSessionHref(input)).toBe(expected);
  });
});

describe("session detail persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips recovery metadata through save and load", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-recovery", now);
    detail.status = "error";
    detail.recovery = {
      reason: "error",
      message: "render failed",
      stage: "running",
      updatedAt: now,
    };

    saveSessionDetail(detail);

    expect(getSessionDetail(detail.id)).toEqual(detail);
  });
});
