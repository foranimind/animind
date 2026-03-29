import { getAssetUrl } from "../../lib/api";
import { getManifestAssetUris } from "../../lib/manifestAssets";
import type { LoadState } from "../../hooks/useAsync";
import type { Manifest } from "../../types/manifest";

type DeliveryExportPanelProps = {
  manifest: LoadState<Manifest>;
};

export const DeliveryExportPanel = ({ manifest }: DeliveryExportPanelProps) => {
  const assets = getManifestAssetUris(manifest.status === "ready" ? manifest.data : undefined);
  const exportMp4 = assets.exportMp4;
  const exportZip = assets.exportZip;

  return (
    <section className="delivery-panel">
      <div className="delivery-panel-header">
        <h2>导出</h2>
      </div>

      <div className="delivery-export-actions">
        {exportMp4 ? (
          <a className="primary-button export-button" href={getAssetUrl(exportMp4)} download>
            导出视频
          </a>
        ) : (
          <button type="button" className="primary-button export-button" disabled>
            导出视频
          </button>
        )}

        {exportZip ? (
          <a className="secondary-button export-button" href={getAssetUrl(exportZip)} download>
            下载 ZIP
          </a>
        ) : null}
      </div>
    </section>
  );
};
