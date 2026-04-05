import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { JobRunPage } from "../pages/JobRunPage";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { saveSessionDetail, setActiveSessionId } from "../lib/storage";

const { navigateSpy, subscribeExistingJobSpy } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  subscribeExistingJobSpy: vi.fn(() => Promise.resolve()),
}));

let jobStatusState = {
  status: "DONE",
  stage: "DONE",
  progress: 100,
  logs_tail: ["done"],
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateSpy,
    useParams: () => ({ id: "job_live" }),
  };
});

vi.mock("../hooks/useJobRunner", () => ({
  useJobRunner: () => ({
    jobId: "job_live",
    jobStatus: jobStatusState,
    error: null,
    isStarting: false,
    connectionState: "connected",
    start: vi.fn(),
    subscribeExistingJob: subscribeExistingJobSpy,
    reset: vi.fn(),
    stop: vi.fn(),
  }),
}));

describe("JobRunPage", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    subscribeExistingJobSpy.mockClear();
    jobStatusState = {
      status: "DONE",
      stage: "DONE",
      progress: 100,
      logs_tail: ["done"],
    };
    localStorage.clear();
  });

  it("routes successful jobs to the delivery page", async () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess_done", now);
    detail.status = "running";
    detail.jobId = "job_live";
    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <JobRunPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith("/works/job_live", { replace: true });
    });
  });

  it("routes failed jobs back to the studio path", async () => {
    jobStatusState = {
      status: "FAILED",
      stage: "FAILED",
      progress: 100,
      logs_tail: ["failed"],
    };

    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess_failed", now);
    detail.status = "running";
    detail.jobId = "job_live";
    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <JobRunPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith("/studio", { replace: true });
    });
  });
});
