import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BrowserRouter } from "react-router-dom";

import { App } from "../App";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { saveSessionDetail, setActiveSessionId } from "../lib/storage";

describe("App routes", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("restores a running active session to the job route on root load", async () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-running", now);
    detail.status = "running";
    detail.jobId = "job-123";
    detail.lastPrompt = "Running scene";

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/jobs/job-123");
    });

    expect(screen.getByRole("heading", { name: "任务运行中" })).toBeInTheDocument();
    expect(screen.getByText(/job-123/)).toBeInTheDocument();
  });
});
