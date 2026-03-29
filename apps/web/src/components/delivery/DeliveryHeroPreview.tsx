import { PreviewPanel } from "../preview/PreviewPanel";
import type { LoadState } from "../../hooks/useAsync";
import type { PreviewConfig } from "../../types/previewConfig";

type DeliveryHeroPreviewProps = {
  preview: LoadState<PreviewConfig>;
  onRetry: () => void;
};

export const DeliveryHeroPreview = ({
  preview,
  onRetry,
}: DeliveryHeroPreviewProps) => {
  if (preview.status === "error" && preview.notFound) {
    return (
      <section className="delivery-panel delivery-hero-preview">
        <div className="delivery-panel-header">
          <h2>成果预览</h2>
        </div>
        <div className="delivery-preview-fallback">
          <strong>后端尚未生成 preview_config</strong>
          <span>结果已交付，但当前预览配置缺失。你仍然可以下载导出资产。</span>
          <button type="button" onClick={onRetry}>
            重试预览
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="delivery-panel delivery-hero-preview">
      <div className="delivery-panel-header">
        <h2>成果预览</h2>
      </div>
      <PreviewPanel
        config={preview.status === "ready" ? preview.data : undefined}
        loading={preview.status === "loading"}
        error={preview.status === "error" ? preview.error : undefined}
        onRetry={onRetry}
        emptyMessage="预览结果将在这里显示。"
      />
    </section>
  );
};
