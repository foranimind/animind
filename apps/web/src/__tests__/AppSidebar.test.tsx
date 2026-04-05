import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AppSidebar } from "../components/sidebar/AppSidebar";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { getActiveSessionId, saveSessionDetail, setActiveSessionId } from "../lib/storage";

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
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
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

  it("routes the new project action and the 创作 link to the studio path", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-draft", now);

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "创作" })).toHaveAttribute("href", "/studio");
    expect(screen.getByRole("link", { name: "创作" })).toHaveClass("active");

    await user.click(screen.getByRole("button", { name: "新建项目" }));

    expect(navigateSpy).toHaveBeenCalledWith("/studio");
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

    expect(screen.queryByRole("button", { name: "Draft scene" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delivered scene" })).not.toHaveClass("active");
  });

  it("keeps the create workspace separate from recent-project highlighting on the create route", () => {
    const now = new Date().toISOString();
    const draft = buildDefaultSessionDetail("sess-draft", now);
    draft.draft = "Draft scene";
    draft.lastPrompt = "Draft scene";

    const done = buildDefaultSessionDetail("sess-done", now);
    done.status = "done";
    done.jobId = "job-123";
    done.lastPrompt = "Delivered scene";

    saveSessionDetail(draft);
    saveSessionDetail(done);
    setActiveSessionId(draft.id);

    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Draft scene" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delivered scene" })).not.toHaveClass("active");
    expect(screen.getByRole("link", { name: "创作" })).toHaveClass("active");
  });

  it("does not render untouched drafts in recent projects", () => {
    const now = new Date().toISOString();
    const untouchedDraft = buildDefaultSessionDetail("sess-draft", now);

    saveSessionDetail(untouchedDraft);
    setActiveSessionId(untouchedDraft.id);

    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    expect(screen.getByText("暂无项目")).toBeInTheDocument();
  });

  it("does not use a system confirm when new project is clicked from an empty draft", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const untouchedDraft = buildDefaultSessionDetail("sess-empty", now);

    saveSessionDetail(untouchedDraft);
    setActiveSessionId(untouchedDraft.id);

    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "新建项目" }));

    expect(globalThis.confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "开始新的草稿" })).not.toBeInTheDocument();
  });

  it("opens a custom replace-draft dialog instead of a system confirm for a non-empty draft", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const draft = buildDefaultSessionDetail("sess-draft", now);
    draft.draft = "retained draft";
    draft.lastPrompt = "retained draft";

    saveSessionDetail(draft);
    setActiveSessionId(draft.id);

    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "新建项目" }));

    expect(globalThis.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "开始新的草稿" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新建草稿" }));

    expect(screen.queryByRole("dialog", { name: "开始新的草稿" })).not.toBeInTheDocument();
    expect(getActiveSessionId()).not.toBe(draft.id);
    expect(navigateSpy).toHaveBeenCalledWith("/studio");
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

  it("does not mount session menu items until a menu is opened", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-draft", now);
    detail.status = "done";
    detail.jobId = "job-123";
    detail.lastPrompt = "Draft scene";

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    const { container } = render(
      <MemoryRouter initialEntries={["/studio"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    expect(container.querySelectorAll(".session-menu-item")).toHaveLength(0);
  });

  it("closes the first session menu when its trigger is clicked again", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const first = buildDefaultSessionDetail("sess-first", now);
    first.status = "done";
    first.jobId = "job-1";
    first.lastPrompt = "First scene";

    const second = buildDefaultSessionDetail("sess-second", now);
    second.status = "done";
    second.jobId = "job-2";
    second.lastPrompt = "Second scene";

    saveSessionDetail(first);
    saveSessionDetail(second);
    setActiveSessionId(first.id);

    const { container } = render(
      <MemoryRouter initialEntries={["/studio"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    const sessionButton = screen.getByRole("button", { name: "First scene" });
    const sessionItem = sessionButton.parentElement;
    if (!(sessionItem instanceof HTMLElement)) {
      throw new Error("Missing session item");
    }
    const actions = sessionItem.querySelector(".session-actions");
    if (!(actions instanceof HTMLElement)) {
      throw new Error("Missing session actions");
    }
    const trigger = within(actions).getByRole("button", { name: "更多操作" });

    await user.click(trigger);
    expect(container.querySelector(".session-menu.open")).toBeTruthy();

    await user.click(trigger);
    expect(container.querySelector(".session-menu.open")).toBeFalsy();
  });

  it("dismisses the first session menu on outside click", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    const first = buildDefaultSessionDetail("sess-first", now);
    first.status = "done";
    first.jobId = "job-1";
    first.lastPrompt = "First scene";

    const second = buildDefaultSessionDetail("sess-second", now);
    second.status = "done";
    second.jobId = "job-2";
    second.lastPrompt = "Second scene";

    saveSessionDetail(first);
    saveSessionDetail(second);
    setActiveSessionId(first.id);

    const { container } = render(
      <MemoryRouter initialEntries={["/studio"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    const sessionButton = screen.getByRole("button", { name: "First scene" });
    const sessionItem = sessionButton.parentElement;
    if (!(sessionItem instanceof HTMLElement)) {
      throw new Error("Missing session item");
    }
    const actions = sessionItem.querySelector(".session-actions");
    if (!(actions instanceof HTMLElement)) {
      throw new Error("Missing session actions");
    }
    const trigger = within(actions).getByRole("button", { name: "更多操作" });

    await user.click(trigger);
    expect(container.querySelector(".session-menu.open")).toBeTruthy();

    await user.click(document.body);
    expect(container.querySelector(".session-menu.open")).toBeFalsy();
  });

  it("keeps the studio rail landmark and collapse control available", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-draft", now);
    detail.lastPrompt = "Draft scene";

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole("complementary", { name: "工作室导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建项目" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起侧栏" })).toBeInTheDocument();
  });

  it("persists the collapsed rail state across remounts", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-draft", now);
    detail.lastPrompt = "Draft scene";

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    const { unmount } = render(
      <MemoryRouter initialEntries={["/studio"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    const expandedRail = screen.getByRole("complementary", { name: "工作室导航" });
    expect(expandedRail).not.toHaveClass("collapsed");

    fireEvent.click(screen.getByRole("button", { name: "收起侧栏" }));

    expect(localStorage.getItem("foranimind.sidebarCollapsed")).toBe("1");
    expect(screen.getByRole("complementary", { name: "工作室导航" })).toHaveClass("collapsed");
    expect(screen.getByRole("button", { name: "展开侧栏" })).toBeInTheDocument();

    unmount();

    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole("complementary", { name: "工作室导航" })).toHaveClass("collapsed");
    expect(screen.getByRole("button", { name: "展开侧栏" })).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Draft scene" })).not.toBeInTheDocument();
  });
});
