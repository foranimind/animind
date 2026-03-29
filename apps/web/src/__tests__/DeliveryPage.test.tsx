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
  it("exposes showcase stage landmarks and the video export action", () => {
    render(<DeliveryPage jobId="job_done" />);

    expect(screen.getByRole("region", { name: "成果舞台" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "交付操作" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "导出视频" })).toBeInTheDocument();
  });

  it("keeps delivery assets visible even when preview config is missing", () => {
    render(<DeliveryPage jobId="job_done" />);

    expect(screen.getByText("预览暂未生成")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载预览" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "导出视频" })).toBeInTheDocument();
  });
});
