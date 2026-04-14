import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LibraryPage } from "../pages/LibraryPage";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { saveSessionDetail } from "../lib/storage";

const createManifestResponse = (jobId: string) =>
  new Response(
    JSON.stringify({
      job_id: jobId,
      created_at: "2026-04-06T11:22:33.000Z",
      status: "DONE",
      inputs: {
        raw_prompt: "A cinematic skyline with rain and neon reflections.",
        style: "cinematic",
        duration_s: 14,
      },
      outputs: {
        scene: {
          panorama: {
            uri: `/assets/${jobId}/scene/panorama.png`,
          },
        },
        export: {
          mp4: {
            uri: `/assets/${jobId}/export/final.mp4`,
          },
        },
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

describe("LibraryPage data flow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("renders completed session history as works after generation", async () => {
    const detail = buildDefaultSessionDetail("sess-done", "2026-04-06T11:20:00.000Z");
    detail.status = "done";
    detail.jobId = "job_done";
    detail.lastPrompt = "A cinematic skyline with rain and neon reflections.";
    detail.draft = detail.lastPrompt;
    saveSessionDetail(detail, {
      status: "done",
      jobId: "job_done",
      updatedAt: "2026-04-06T11:25:00.000Z",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(createManifestResponse("job_done"));

    const { container } = render(<LibraryPage />);

    await waitFor(() => {
      expect(container.querySelector('a[href="/works/job_done"]')).toBeInTheDocument();
    });
    expect(screen.queryByText("这里还没有作品归档")).not.toBeInTheDocument();
  });

  it("removes a rendered work from the library when the card action is used", async () => {
    const user = userEvent.setup();
    const detail = buildDefaultSessionDetail("sess-remove", "2026-04-06T11:20:00.000Z");
    detail.status = "done";
    detail.jobId = "job_remove";
    detail.lastPrompt = "A stormy ocean under moonlight.";
    detail.draft = detail.lastPrompt;
    saveSessionDetail(detail, {
      status: "done",
      jobId: "job_remove",
      updatedAt: "2026-04-06T11:25:00.000Z",
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(createManifestResponse("job_remove"));

    const { container } = render(<LibraryPage />);

    await waitFor(() => {
      expect(container.querySelector('a[href="/works/job_remove"]')).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "更多操作" }));
    await user.click(screen.getByRole("menuitem", { name: "移除" }));

    await waitFor(() => {
      expect(container.querySelector('a[href="/works/job_remove"]')).not.toBeInTheDocument();
    });
    expect(screen.getByText("这里还没有作品归档")).toBeInTheDocument();
  });
});
