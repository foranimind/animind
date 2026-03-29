import "../pages/run.css";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { JobRunPage } from "../pages/JobRunPage";

const getStylesheetText = () =>
  Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText);
      } catch {
        return [];
      }
    })
    .join("\n");

const { subscribeExistingJobSpy } = vi.hoisted(() => ({
  subscribeExistingJobSpy: vi.fn(() => Promise.resolve()),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: "job_stage" }),
  };
});

vi.mock("../hooks/useJobRunner", () => ({
  useJobRunner: () => ({
    jobId: "job_stage",
    jobStatus: {
      status: "RUNNING_SCENE",
      stage: "RUNNING_SCENE",
      progress: 54,
      logs_tail: ["scene render started"],
      queue_position: 2,
    },
    error: null,
    isStarting: false,
    connectionState: "connected",
    start: vi.fn(),
    subscribeExistingJob: subscribeExistingJobSpy,
    reset: vi.fn(),
    stop: vi.fn(),
  }),
}));

describe("Run panels", () => {
  it("exposes the execution progress and preview stage landmarks", () => {
    render(
      <MemoryRouter>
        <JobRunPage />
      </MemoryRouter>
    );

    expect(screen.getByText("执行剧场").closest("header")?.querySelector(".status-pill")).toHaveClass(
      "status-pill",
      "status-pill-loading"
    );
    expect(screen.getByRole("region", { name: "执行进度" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "预览舞台" })).toBeInTheDocument();
    expect(screen.getByText("54%")).toBeVisible();
    expect(screen.getByRole("button", { name: "取消生成" })).toBeEnabled();
    expect(screen.getByText("预览生成后会出现在这里。")).toBeVisible();
  });

  it("keeps mobile layout order aligned with DOM order", () => {
    expect(getStylesheetText()).not.toMatch(/order:\s*-1/);
  });
});
