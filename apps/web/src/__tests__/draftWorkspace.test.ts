import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureDraftSession } from "../lib/sessionActions";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import {
  getActiveSessionId,
  listEmptySessions,
  listRecentSessions,
  saveSessionDetail,
  setActiveSessionId,
} from "../lib/storage";

describe("draft workspace storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("reuses the latest edited draft as the create workspace without exposing it in recent projects", () => {
    const now = new Date().toISOString();
    const draft = buildDefaultSessionDetail("sess-draft", now);
    draft.draft = "late afternoon city flythrough";
    draft.lastPrompt = "late afternoon city flythrough";

    const history = buildDefaultSessionDetail("sess-done", now);
    history.status = "done";
    history.jobId = "job-123";
    history.lastPrompt = "Completed scene";

    saveSessionDetail(draft);
    saveSessionDetail(history);
    setActiveSessionId(history.id);

    const reopened = ensureDraftSession();

    expect(reopened.id).toBe(draft.id);
    expect(getActiveSessionId()).toBe(draft.id);
    expect(listRecentSessions().map((item) => item.id)).toEqual([history.id]);
  });

  it("treats prompt edits and option changes as meaningful work, not empty drafts", () => {
    const now = new Date().toISOString();

    const untouched = buildDefaultSessionDetail("sess-empty", now);
    saveSessionDetail(untouched);

    const typed = buildDefaultSessionDetail("sess-typed", now);
    typed.draft = "rain over neon streets";
    saveSessionDetail(typed);

    const restyled = buildDefaultSessionDetail("sess-restyled", now);
    restyled.options = {
      ...restyled.options,
      style: "anime",
    };
    saveSessionDetail(restyled);

    expect(listEmptySessions().map((item) => item.id)).toEqual(["sess-empty"]);
  });
});
