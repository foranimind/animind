import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { DeliveryAssetsPanel } from "../components/delivery/DeliveryAssetsPanel";
import { DeliveryExportPanel } from "../components/delivery/DeliveryExportPanel";
import { DeliveryHeroPreview } from "../components/delivery/DeliveryHeroPreview";
import { useWorkDetail } from "../hooks/useWorkDetail";
import { getWorkDetailStatusInfo } from "../lib/status";
import "./pages.css";
import "./delivery.css";

type DeliveryPageProps = {
  jobId?: string;
};

export const DeliveryPage = ({ jobId }: DeliveryPageProps) => {
  const resolvedJobId = jobId?.trim();
  const { manifest, preview, reload } = useWorkDetail(resolvedJobId);
  const statusInfo = getWorkDetailStatusInfo({
    manifestStatus: manifest.status,
    previewStatus: preview.status,
    manifestNotFound: manifest.notFound,
  });

  return (
    <div className="page delivery-page">
      <PageHeader
        eyebrow="Showcase Stage"
        title="交付结果"
        description="预览作为主舞台呈现成片结果，资产与导出作为配套交付动作保留在侧边。"
        accessory={<StatusPill tone={statusInfo.tone}>{statusInfo.label}</StatusPill>}
      />

      <div className="delivery-stage-layout">
        <section className="delivery-stage-main" aria-label="成果舞台">
          <DeliveryHeroPreview preview={preview} onRetry={reload} />
        </section>
        <aside className="delivery-stage-actions" aria-label="交付操作">
          <DeliveryAssetsPanel manifest={manifest} />
          <DeliveryExportPanel manifest={manifest} />
        </aside>
      </div>
    </div>
  );
};
