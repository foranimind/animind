import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeliveryPage } from "../pages/DeliveryPage";

vi.mock("../hooks/useWorkDetail", () => ({
  useWorkDetail: () => ({
    manifest: {
      status: "ready",
      notFound: false,
      data: {
        job_id: "job_done",
        outputs: {
          export: {
            mp4: { uri: "exports/demo.mp4" },
            zip: { uri: "exports/demo.zip" },
          },
        },
      },
    },
    preview: {
      status: "error",
      notFound: true,
      error: "preview missing",
      data: null,
    },
    reload: vi.fn(),
  }),
}));

describe("DeliveryPage", () => {
  it("keeps delivery assets visible even when preview config is missing", () => {
    render(<DeliveryPage jobId="job_done" />);

    expect(screen.getByText("后端尚未生成 preview_config")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "导出视频" })).toBeInTheDocument();
  });
});
