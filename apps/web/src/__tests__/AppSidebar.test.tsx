import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AppSidebar } from "../components/sidebar/AppSidebar";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { saveSessionDetail, setActiveSessionId } from "../lib/storage";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

describe("AppSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    navigateSpy.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders canceled status class for sessions", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-canceled", now);
    detail.status = "canceled";
    detail.lastPrompt = "Canceled scene";

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    const sessionButton = screen.getByRole("button", { name: "Canceled scene" });
    expect(sessionButton).toHaveClass("session-status-canceled");
  });

  it("opens a running session on the job route", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-running", now);
    detail.status = "running";
    detail.jobId = "job-123";
    detail.lastPrompt = "Running scene";

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    screen.getByRole("button", { name: "Running scene" }).click();

    expect(navigateSpy).toHaveBeenCalledWith("/jobs/job-123");
  });

  it("does not mark a recent project as current on the library route", () => {
    const now = new Date().toISOString();
    const draft = buildDefaultSessionDetail("sess-draft", now);
    draft.lastPrompt = "Draft scene";

    const done = buildDefaultSessionDetail("sess-done", now);
    done.status = "done";
    done.jobId = "job-123";
    done.lastPrompt = "Delivered scene";

    saveSessionDetail(draft);
    saveSessionDetail(done);
    setActiveSessionId(draft.id);

    render(
      <MemoryRouter initialEntries={["/works"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Draft scene" })).not.toHaveClass("active");
    expect(screen.getByRole("button", { name: "Delivered scene" })).not.toHaveClass("active");
  });

  it("does not mark a recent project as current on the create route", () => {
    const now = new Date().toISOString();
    const draft = buildDefaultSessionDetail("sess-draft", now);
    draft.lastPrompt = "Draft scene";

    const done = buildDefaultSessionDetail("sess-done", now);
    done.status = "done";
    done.jobId = "job-123";
    done.lastPrompt = "Delivered scene";

    saveSessionDetail(draft);
    saveSessionDetail(done);
    setActiveSessionId(draft.id);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Draft scene" })).not.toHaveClass("active");
    expect(screen.getByRole("button", { name: "Delivered scene" })).not.toHaveClass("active");
  });

  it("does not highlight any recent project when the active session is absent from the list", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-done", now);
    detail.status = "done";
    detail.jobId = "job-123";
    detail.lastPrompt = "Delivered scene";

    saveSessionDetail(detail);
    setActiveSessionId("sess-missing");

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Delivered scene" })).not.toHaveClass("active");
  });

  it("keeps the studio rail landmark and collapse control available", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-draft", now);
    detail.lastPrompt = "Draft scene";

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole("complementary", { name: "工作室导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建项目" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起侧栏" })).toBeInTheDocument();
  });

  it("treats a delivery result route as part of the create workflow in the sidebar", () => {
    const now = new Date().toISOString();
    const draft = buildDefaultSessionDetail("sess-draft", now);
    draft.lastPrompt = "Draft scene";

    const done = buildDefaultSessionDetail("sess-done", now);
    done.status = "done";
    done.jobId = "job-123";
    done.lastPrompt = "Delivered scene";

    saveSessionDetail(draft);
    saveSessionDetail(done);
    setActiveSessionId(draft.id);

    render(
      <MemoryRouter initialEntries={["/works/job-123"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "创作" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "我的作品" })).not.toHaveClass("active");
    expect(screen.getByRole("button", { name: "Delivered scene" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "Draft scene" })).not.toHaveClass("active");
  });
});
