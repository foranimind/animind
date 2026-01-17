import { PreviewPanel } from "../preview/PreviewPanel";
import { SelectMenu, type SelectOption } from "../ui/SelectMenu";
import type { AssetItem, InspectorTab } from "../../pages/create/types";
import type { PreviewConfig } from "../../types/previewConfig";

type InspectorResultsPanelProps = {
  tabs: Array<{ id: InspectorTab; label: string }>;
  activeTab: InspectorTab;
  onTabChange: (value: InspectorTab) => void;
  previewConfig: PreviewConfig | null;
  previewConfigMissing: boolean;
  assetError: string | null;
  isLoadingAssets: boolean;
  previewLinks: AssetItem[];
  assetDownloads: AssetItem[];
  audioPreviewSrc: string;
  exportPreset: string;
  exportOptions: SelectOption[];
  onExportPresetChange: (value: string) => void;
  exportMp4?: AssetItem;
  jobId?: string;
};

export const InspectorResultsPanel = ({
  tabs,
  activeTab,
  onTabChange,
  previewConfig,
  previewConfigMissing,
  assetError,
  isLoadingAssets,
  previewLinks,
  assetDownloads,
  audioPreviewSrc,
  exportPreset,
  exportOptions,
  onExportPresetChange,
  exportMp4,
  jobId,
}: InspectorResultsPanelProps) => (
  <>
    <div className="inspector-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`inspector-tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
    <div className="inspector-tab-content">
      {activeTab === "preview" && (
        <>
          {previewConfig ? (
            <div className="preview-panel-wrapper">
              <PreviewPanel jobId={jobId} config={previewConfig} emptyMessage="预览配置已加载" />
            </div>
          ) : (
            <div className="preview-fallback">
              {previewConfigMissing && (
                <div className="preview-fallback-banner">
                  后端尚未生成 preview_config，已降级为资源链接。
                </div>
              )}
              {assetError && (
                <div className="preview-fallback-banner preview-fallback-error">{assetError}</div>
              )}
              {isLoadingAssets && (
                <div className="preview-placeholder-screen">
                  <div className="preview-placeholder-hint">正在加载预览资源...</div>
                </div>
              )}
              {!isLoadingAssets && (
                <>
                  <div className="preview-placeholder-screen">
                    <div className="preview-placeholder-hint">预览配置不可用</div>
                  </div>
                  <div className="preview-placeholder-meta">
                    <div className="preview-placeholder-title">可用资源</div>
                    <div className="preview-placeholder-subtitle">点击以下链接打开或下载。</div>
                  </div>
                  <div className="preview-link-list">
                    {previewLinks.length > 0 ? (
                      previewLinks.map((item) => (
                        <a
                          key={item.id}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="preview-link"
                        >
                          {item.label}
                        </a>
                      ))
                    ) : (
                      <div className="preview-placeholder-subtitle">暂无可用预览资源。</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {audioPreviewSrc ? (
            <div className="preview-audio">
              <div className="preview-audio-title">音频预览</div>
              <audio controls src={audioPreviewSrc} preload="none" />
            </div>
          ) : (
            <div className="preview-audio-empty">暂无音频</div>
          )}
        </>
      )}
      {activeTab === "assets" && (
        <div className="assets-panel">
          {isLoadingAssets && <div className="inspector-callout">正在加载资产清单...</div>}
          {!isLoadingAssets && assetError && <div className="inspector-callout">{assetError}</div>}
          {!isLoadingAssets && assetDownloads.length === 0 && (
            <div className="inspector-callout">暂无可下载资源。</div>
          )}
          {!isLoadingAssets && assetDownloads.length > 0 && (
            <div className="placeholder-grid">
              {assetDownloads.map((item) => (
                <div key={item.id} className="placeholder-card">
                  <div className="placeholder-title">{item.label}</div>
                  <a className="asset-link" href={item.href} target="_blank" rel="noreferrer">
                    打开/下载
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === "export" && (
        <div className="export-panel">
          <div className="export-settings">
            <label className="export-field">
              <span>导出预设</span>
              <SelectMenu
                value={exportPreset}
                options={exportOptions}
                ariaLabel="导出预设"
                onChange={onExportPresetChange}
              />
            </label>
          </div>
          <div className="export-actions">
            {exportMp4 ? (
              <a className="primary-button export-button" href={exportMp4.href} download>
                导出视频
              </a>
            ) : (
              <button type="button" className="primary-button export-button" disabled>
                导出视频
              </button>
            )}
            <div className="export-note">
              {exportMp4 ? "视频已生成，可直接下载。" : "导出资源尚未生成或导出服务未接入。"}
            </div>
          </div>
        </div>
      )}
    </div>
  </>
);
