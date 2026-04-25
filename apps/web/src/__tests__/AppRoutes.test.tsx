import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BrowserRouter } from "react-router-dom";

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

  it("keeps the public welcome page on root load when a running session exists", async () => {
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
      expect(window.location.pathname).toBe("/");
    }, { timeout: 3000 });
    expect(
      await screen.findByRole("heading", { name: "Motionverse Studio" }, { timeout: 3000 })
    ).toBeInTheDocument();
    const continueLinks = await screen.findAllByRole("link", { name: "继续创作" });
    expect(continueLinks.length).toBeGreaterThan(0);
    continueLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/jobs/job-123");
    });
  });

  it("restores a running active session from the studio route to the job route", async () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-running", now);
    detail.status = "running";
    detail.jobId = "job-123";
    detail.lastPrompt = "Running scene";

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    window.history.pushState({}, "", "/studio");

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/jobs/job-123");
    }, { timeout: 3000 });
    expect(await screen.findByRole("heading", { name: "任务进度" }, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText(/job-123/, undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it("switches completed history back to a draft workspace on the studio route", async () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-done", now);
    detail.status = "done";
    detail.jobId = "job-456";
    detail.lastPrompt = "Completed scene";
    detail.draft = "Completed scene";

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    window.history.pushState({}, "", "/studio");

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/studio");
    }, { timeout: 3000 });

    expect(await screen.findByRole("heading", { name: "创作台" }, { timeout: 3000 })).toBeInTheDocument();
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

  it("does not render running or delivery controls on the studio route", async () => {
    window.history.pushState({}, "", "/studio");

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    expect(await screen.findByRole("heading", { name: "创作台" }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText("任务进度")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消生成" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "导出视频" })).not.toBeInTheDocument();
  });

  it("redirects unknown routes to the public landing page", async () => {
    window.history.pushState({}, "", "/not-a-route");

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
    }, { timeout: 3000 });

    expect(
      await screen.findByRole("heading", { name: "Motionverse Studio" }, { timeout: 3000 })
    ).toBeInTheDocument();
  });
});
