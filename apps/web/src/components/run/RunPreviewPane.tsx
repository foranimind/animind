import { getAssetUrl } from "../../lib/api";
import type { JobStatus } from "../../types/job";
import { ActionButton } from "../ui/ActionButton";
import { SurfacePanel } from "../ui/SurfacePanel";

type RunPreviewPaneProps = {
  jobId?: string;
  status: JobStatus | null;
};

export const RunPreviewPane = ({ jobId, status }: RunPreviewPaneProps) => (
  <SurfacePanel
    tone="hero"
    className="run-card run-preview-pane"
    header={
      <div className="run-card-heading">
        <h2 className="run-card-title">实时预览</h2>
        <span className="run-preview-id">{jobId ?? "未关联任务"}</span>
      </div>
    }
  >
    <div className="run-preview-stage">
      {status?.preview_url ? (
        <ActionButton
          href={getAssetUrl(status.preview_url)}
          target="_blank"
          rel="noreferrer"
          className="run-preview-link"
        >
          打开当前预览
        </ActionButton>
      ) : (
        <span className="run-preview-empty">预览生成后会出现在这里。</span>
      )}
    </div>
  </SurfacePanel>
);
