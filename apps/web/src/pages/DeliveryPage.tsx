import { DeliveryAssetsPanel } from "../components/delivery/DeliveryAssetsPanel";
import { DeliveryExportPanel } from "../components/delivery/DeliveryExportPanel";
import { DeliveryHeroPreview } from "../components/delivery/DeliveryHeroPreview";
import { useWorkDetail } from "../hooks/useWorkDetail";
import { getWorkDetailStatusInfo } from "../lib/status";
import "./pages.css";
import "./workDetail.css";

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
    <div className="page work-detail-page">
      <header className="page-header work-detail-header">
        <div className="work-detail-title">
          <h1 className="page-title">交付结果</h1>
          <span className={`work-detail-status ${statusInfo.tone}`}>
            <span className="work-detail-status-dot" aria-hidden="true" />
            {statusInfo.label}
          </span>
        </div>
      </header>

      <div className="delivery-shell">
        <DeliveryHeroPreview preview={preview} onRetry={reload} />
        <div className="delivery-side-column">
          <DeliveryAssetsPanel manifest={manifest} />
          <DeliveryExportPanel manifest={manifest} />
        </div>
      </div>
    </div>
  );
};
