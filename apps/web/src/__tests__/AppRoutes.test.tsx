import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BrowserRouter, MemoryRouter } from "react-router-dom";

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

    expect(screen.getByRole("heading", { name: "任务进度" })).toBeInTheDocument();
    expect(screen.getByText(/job-123/)).toBeInTheDocument();
  });

  it("keeps a completed active session on the create route instead of reopening delivery", async () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-done", now);
    detail.status = "done";
    detail.jobId = "job-456";
    detail.lastPrompt = "Completed scene";
    detail.draft = "Completed scene";

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
    });

    expect(screen.getByText("创作描述")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "交付结果" })).not.toBeInTheDocument();
  });

  it("does not render running or delivery controls on the create route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.queryByText("任务进度")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消生成" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "导出视频" })).not.toBeInTheDocument();
  });
});
