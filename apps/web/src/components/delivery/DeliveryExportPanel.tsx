import { getAssetUrl } from "../../lib/api";
import { getManifestAssetUris } from "../../lib/manifestAssets";
import type { LoadState } from "../../hooks/useAsync";
import type { Manifest } from "../../types/manifest";
import { ActionButton } from "../ui/ActionButton";
import { SurfacePanel } from "../ui/SurfacePanel";

type DeliveryExportPanelProps = {
  manifest: LoadState<Manifest>;
};

export const DeliveryExportPanel = ({ manifest }: DeliveryExportPanelProps) => {
  const assets = getManifestAssetUris(manifest.status === "ready" ? manifest.data : undefined);
  const exportMp4 = assets.exportMp4;
  const exportZip = assets.exportZip;

  return (
    <SurfacePanel
      className="delivery-panel delivery-export-panel"
      header={
        <div className="delivery-panel-heading">
          <h2 className="delivery-panel-title">导出</h2>
        </div>
      }
    >
      <div className="delivery-export-actions">
        {exportMp4 ? (
          <ActionButton href={getAssetUrl(exportMp4)} download className="delivery-export-button">
            导出视频
          </ActionButton>
        ) : (
          <ActionButton className="delivery-export-button" disabled>
            导出视频
          </ActionButton>
        )}

        {exportZip ? (
          <ActionButton
            href={getAssetUrl(exportZip)}
            download
            variant="ghost"
            className="delivery-export-button"
          >
            下载 ZIP
          </ActionButton>
        ) : null}
      </div>
    </SurfacePanel>
  );
};
