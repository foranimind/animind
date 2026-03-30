import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { CreatePage } from "../pages/CreatePage";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { getActiveSessionId, getSessionDetail, saveSessionDetail, setActiveSessionId } from "../lib/storage";

const { navigateSpy, createJobSpy } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  createJobSpy: vi.fn(() => Promise.resolve({ job_id: "job_live" })),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    createJob: createJobSpy,
    subscribeJobEvents: vi.fn(() => ({
      close: vi.fn(),
    })),
  };
});

describe("CreatePage recovery", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
  });

  beforeEach(() => {
    navigateSpy.mockReset();
    createJobSpy.mockClear();
    localStorage.clear();
  });

  it("shows a recovery banner and restored draft after cancellation", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess_cancel", now);
    detail.status = "canceled";
    detail.draft = "sunset skyline with slow orbit camera";
    detail.lastPrompt = detail.draft;
    detail.messages.push({ id: "user-1", role: "user", content: detail.draft });
    detail.recovery = {
      reason: "canceled",
      message: "用户取消",
      stage: "RUNNING_SCENE",
      updatedAt: now,
    };
    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    expect(screen.getByText("任务已取消")).toBeInTheDocument();
    expect(screen.getByDisplayValue("sunset skyline with slow orbit camera")).toBeInTheDocument();
  });

  it("creates a job from the prompt composer and navigates to the run page", async () => {
    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(getActiveSessionId()).toBeTruthy());
    await userEvent.type(
      await screen.findByPlaceholderText("描述你的场景、光线、动作与配乐..."),
      "rainy alley with synthwave music"
    );
    await userEvent.click(screen.getByRole("button", { name: "开始生成" }));

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/jobs/job_live"));
  });

  it("organizes the composer desk into main and support landmarks", async () => {
    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("region", { name: "创作主区" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "创作设置" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始生成" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "开始生成" })).toHaveClass("prompt-composer-submit");
    expect(screen.getByRole("button", { name: "风格" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "情绪" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "风格" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "情绪" })).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "时长 14s" })).toHaveClass("ui-range");
    expect(screen.getByText("全景 2K")).toBeInTheDocument();
    expect(screen.getByText("2048×1024")).toBeInTheDocument();
    expect(screen.getByText("1080p")).toBeInTheDocument();
    expect(screen.getByText("1920×1080")).toBeInTheDocument();
  });

  it("places recovered context before the composer in document order when recovery exists", async () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess_recovery_order", now);
    detail.status = "canceled";
    detail.draft = "restored draft";
    detail.lastPrompt = detail.draft;
    detail.messages.push({ id: "user-1", role: "user", content: detail.draft });
    detail.recovery = {
      reason: "canceled",
      message: "恢复排序",
      updatedAt: now,
    };
    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    const recoveryPanel = screen.getByText("任务已取消").closest(".recovered-context-panel");
    const composerRegion = screen.getByRole("region", { name: "创作主区" });

    expect(recoveryPanel).toBeTruthy();
    if (!recoveryPanel) {
      throw new Error("Expected recovered context panel");
    }
    expect(
      recoveryPanel.compareDocumentPosition(composerRegion) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("shows helper chips as category prompts instead of concrete examples", async () => {
    const { container } = render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    const composer = await screen.findByPlaceholderText("描述你的场景、光线、动作与配乐...");

    expect(screen.getByRole("button", { name: "镜头" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "光线" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "镜头：缓慢环绕主角" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "镜头" }));

    expect(composer).toHaveValue("镜头：");
    expect(screen.getByRole("button", { name: "镜头" }).closest(".prompt-composer-panel")).toBeTruthy();
    expect(container.querySelector(".create-desk-layout > .prompt-helper-bar")).toBeNull();
  });

  it("keeps prompt helpers and submit action in the same footer group", async () => {
    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    const submitButton = await screen.findByRole("button", { name: "开始生成" });
    const footer = submitButton.closest(".prompt-composer-footer");

    expect(footer).toBeTruthy();
    expect(footer?.querySelector(".prompt-helper-bar")).toBeTruthy();
    expect(footer?.querySelector(".prompt-composer-actions")).toBeTruthy();
  });

  it("only reserves the recovery layout row when recovery content exists", async () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("region", { name: "创作主区" })).toBeInTheDocument();
    expect(container.querySelector(".create-desk-layout")?.classList.contains("has-recovery")).toBe(false);

    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess_recovery_layout", now);
    detail.status = "canceled";
    detail.draft = "restored draft";
    detail.lastPrompt = detail.draft;
    detail.recovery = {
      reason: "canceled",
      message: "恢复布局",
      updatedAt: now,
    };
    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    rerender(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(container.querySelector(".create-desk-layout")?.classList.contains("has-recovery")).toBe(true);
    });
  });

  it("updates to the newly active draft session while already on the create route", async () => {
    const now = new Date().toISOString();
    const first = buildDefaultSessionDetail("sess_first", now);
    first.draft = "first draft";
    first.lastPrompt = first.draft;

    const second = buildDefaultSessionDetail("sess_second", now);
    second.status = "canceled";
    second.draft = "second draft";
    second.lastPrompt = second.draft;
    second.recovery = {
      reason: "canceled",
      message: "切换恢复",
      updatedAt: now,
    };

    saveSessionDetail(first);
    saveSessionDetail(second);
    setActiveSessionId(first.id);

    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    expect(screen.getByDisplayValue("first draft")).toBeInTheDocument();

    setActiveSessionId(second.id);

    await waitFor(() => {
      expect(screen.getByDisplayValue("second draft")).toBeInTheDocument();
    });
    expect(screen.getByText("任务已取消")).toBeInTheDocument();
  });

  it("does not overwrite the local draft when the same active session updates", async () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess_same", now);
    detail.draft = "persisted draft";
    detail.lastPrompt = detail.draft;

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    const composer = await screen.findByPlaceholderText("描述你的场景、光线、动作与配乐...");
    expect(screen.getByDisplayValue("persisted draft")).toBeInTheDocument();

    await userEvent.clear(composer);
    await userEvent.type(composer, "locally edited draft");

    saveSessionDetail({
      ...detail,
      updatedAt: new Date(Date.now() + 1000).toISOString(),
      recovery: {
        reason: "error",
        message: "background update",
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      },
    });

    await waitFor(() => {
      expect(screen.getByText("生成失败")).toBeInTheDocument();
    });
    expect(screen.getByText("background update")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue("locally edited draft")).toBeInTheDocument();
    });
  });

  it("persists edited draft content and option changes into the hidden draft workspace", async () => {
    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    const composer = (await screen.findByPlaceholderText(
      "描述你的场景、光线、动作与配乐..."
    )) as HTMLTextAreaElement;
    await userEvent.type(composer, "storm over the harbor");
    await userEvent.click(screen.getByRole("button", { name: "风格" }));
    await userEvent.click(screen.getByRole("option", { name: "动漫" }));

    await waitFor(() => {
      const activeSessionId = getActiveSessionId();
      expect(activeSessionId).toBeTruthy();
      const detail = getSessionDetail(activeSessionId ?? "");
      expect(detail?.draft).toBe("storm over the harbor");
      expect(detail?.options.style).toBe("anime");
      expect(detail?.status).toBe("draft");
    });
  });
});
