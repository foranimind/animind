import { getAssetUrl } from "../../lib/api";
import { getManifestAssetUris } from "../../lib/manifestAssets";
import type { LoadState } from "../../hooks/useAsync";
import type { Manifest } from "../../types/manifest";

type DeliveryAssetsPanelProps = {
  manifest: LoadState<Manifest>;
};

const ASSET_LABELS: Array<{
  key: keyof ReturnType<typeof getManifestAssetUris>;
  label: string;
}> = [
  { key: "scenePanorama", label: "全景 PNG" },
  { key: "motionBvh", label: "动作 BVH" },
  { key: "musicWav", label: "音频 WAV" },
  { key: "exportMp4", label: "MP4 文件" },
  { key: "exportZip", label: "ZIP 文件" },
];

export const DeliveryAssetsPanel = ({ manifest }: DeliveryAssetsPanelProps) => {
  const assets = getManifestAssetUris(manifest.status === "ready" ? manifest.data : undefined);

  return (
    <section className="delivery-panel">
      <div className="delivery-panel-header">
        <h2>交付资产</h2>
      </div>

      <div className="delivery-assets-grid">
        {ASSET_LABELS.map(({ key, label }) => {
          const uri = assets[key];
          return uri ? (
            <a key={key} className="delivery-asset-link" href={getAssetUrl(uri)} download>
              {label}
            </a>
          ) : (
            <div key={key} className="delivery-asset-link disabled" aria-disabled="true">
              {label}
            </div>
          );
        })}
      </div>
    </section>
  );
};
