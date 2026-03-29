import { getAssetUrl } from "../../lib/api";
import type { JobStatus } from "../../types/job";

type RunPreviewPaneProps = {
  jobId?: string;
  status: JobStatus | null;
};

export const RunPreviewPane = ({ jobId, status }: RunPreviewPaneProps) => (
  <section className="run-panel run-preview-pane">
    <div className="run-panel-header">
      <h2>实时预览</h2>
      <span>{jobId ?? "未关联任务"}</span>
    </div>

    <div className="run-preview-card">
      {status?.preview_url ? (
        <a href={getAssetUrl(status.preview_url)} target="_blank" rel="noreferrer">
          打开当前预览
        </a>
      ) : (
        <span>预览生成后会出现在这里。</span>
      )}
    </div>
  </section>
);
