import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BrowserRouter, MemoryRouter } from "react-router-dom";

import { App } from "../App";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { getActiveSessionId, getSessionDetail, saveSessionDetail, setActiveSessionId } from "../lib/storage";

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

  it("switches completed history back to the draft workspace on root load", async () => {
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
    const composer = screen.getByPlaceholderText("描述你的场景、光线、动作与配乐...") as HTMLTextAreaElement;
    expect(composer.value).toBe("");
    expect(screen.queryByDisplayValue("Completed scene")).not.toBeInTheDocument();
    await waitFor(() => {
      const activeSessionId = getActiveSessionId();
      expect(activeSessionId).toBeTruthy();
      expect(activeSessionId).not.toBe(detail.id);
      expect(getSessionDetail(activeSessionId ?? "")?.status).toBe("draft");
    });
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
