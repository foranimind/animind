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
          <div className="delivery-preview-copy">
            <strong>预览暂未生成</strong>
            <span>结果已交付，但后端还没有返回预览配置。你仍然可以先下载资产。</span>
          </div>
          <button type="button" className="primary-button preview-panel-retry" onClick={onRetry}>
            重新加载预览
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
