import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeliveryPage } from "../pages/DeliveryPage";

vi.mock("../components/preview/PreviewPanel", () => ({
  PreviewPanel: () => <div data-testid="preview-panel-marker">preview panel marker</div>,
}));

type MockWorkDetailState = {
  manifest: {
    status: "ready";
    notFound: boolean;
    data: {
      job_id: string;
      outputs: {
        export: {
          mp4: { uri: string };
          zip: { uri: string };
        };
      };
    };
  };
  preview: {
    status: "ready" | "error";
    notFound: boolean;
    error: string | null;
    data: Record<string, unknown> | null;
  };
  reload: ReturnType<typeof vi.fn>;
};

const createWorkDetailState = (): MockWorkDetailState => ({
  manifest: {
    status: "ready" as const,
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
    status: "error" as const,
    notFound: true,
    error: "preview missing",
    data: null,
  },
  reload: vi.fn(),
});

let mockedWorkDetailState = createWorkDetailState();

vi.mock("../hooks/useWorkDetail", () => ({
  useWorkDetail: () => mockedWorkDetailState,
}));

describe("DeliveryPage", () => {
  beforeEach(() => {
    mockedWorkDetailState = createWorkDetailState();
  });

  it("renders the preview stage with the preview panel when preview data is ready", () => {
    mockedWorkDetailState = {
      ...createWorkDetailState(),
      preview: {
        status: "ready",
        notFound: false,
        error: null,
        data: {
          version: 1,
          audio_url: null,
          render: {
            scene_url: "/assets/previews/demo.glb",
          },
        },
      },
    };

    render(<DeliveryPage jobId="job_done" />);

    expect(screen.getByRole("region", { name: "成果舞台" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "交付操作" })).toBeInTheDocument();
    expect(screen.getByTestId("preview-panel-marker")).toBeInTheDocument();
  });

  it("exposes showcase stage landmarks and the video export action", () => {
    render(<DeliveryPage jobId="job_done" />);

    expect(screen.getByRole("region", { name: "成果舞台" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "交付操作" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "导出视频" })).toBeInTheDocument();
  });

  it("keeps delivery assets visible even when preview config is missing", () => {
    render(<DeliveryPage jobId="job_done" />);

    const showcaseStage = screen.getByRole("region", { name: "成果舞台" });
    const deliveryActions = screen.getByRole("complementary", { name: "交付操作" });
    const assetsPanel = screen.getByRole("heading", { name: "交付资产" }).closest("section");
    const exportPanel = screen.getByRole("heading", { name: "导出" }).closest("section");

    expect(showcaseStage).toBeInTheDocument();
    expect(deliveryActions).toBeInTheDocument();
    expect(screen.getByText("预览暂未生成")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载预览" })).toBeInTheDocument();
    expect(assetsPanel).not.toBeNull();
    expect(exportPanel).not.toBeNull();

    const assets = within(assetsPanel!);
    const exportActions = within(exportPanel!);
    const assetMp4 = assets.getByRole("link", { name: "MP4 文件" });
    const assetZip = assets.getByRole("link", { name: "ZIP 文件" });
    const exportVideo = exportActions.getByRole("link", { name: "导出视频" });
    const exportZip = exportActions.getByRole("link", { name: "下载 ZIP" });

    expect(assetMp4).toBeVisible();
    expect(assetMp4).toHaveAttribute("href", "/assets/exports/demo.mp4");
    expect(assetMp4).toHaveAttribute("download");
    expect(assetZip).toBeVisible();
    expect(assetZip).toHaveAttribute("href", "/assets/exports/demo.zip");
    expect(assetZip).toHaveAttribute("download");
    expect(exportVideo).toHaveAttribute("href", "/assets/exports/demo.mp4");
    expect(exportVideo).toHaveAttribute("download");
    expect(exportZip).toHaveAttribute("href", "/assets/exports/demo.zip");
    expect(exportZip).toHaveAttribute("download");
  });
});
