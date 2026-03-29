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
});
