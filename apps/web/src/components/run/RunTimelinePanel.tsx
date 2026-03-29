import type { JobStatus } from "../../types/job";
import { resolveJobStageLabel } from "../../lib/status";
import { SurfacePanel } from "../ui/SurfacePanel";

type RunTimelinePanelProps = {
  status: JobStatus | null;
};

export const RunTimelinePanel = ({ status }: RunTimelinePanelProps) => {
  const progressValue =
    typeof status?.progress === "number"
      ? Math.max(0, Math.min(100, Math.round(status.progress)))
      : 0;
  const stageLabel = resolveJobStageLabel(status?.stage, status?.status);

  return (
    <SurfacePanel
      className="run-card run-timeline-panel"
      header={
        <div className="run-card-heading">
          <h2 className="run-card-title">任务进度</h2>
          <span className="run-stage-pill">{stageLabel}</span>
        </div>
      }
    >
      <div className="run-progress-row">
        <strong>{progressValue}%</strong>
        <span>{status?.status ?? "等待中"}</span>
      </div>

      <div className="run-progress-track" aria-hidden="true">
        <div className="run-progress-fill" style={{ width: `${progressValue}%` }} />
      </div>

      <dl className="run-meta-grid">
        <div>
          <dt>队列</dt>
          <dd>{status?.queue_position !== undefined ? `#${status.queue_position}` : "--"}</dd>
        </div>
        <div>
          <dt>阶段</dt>
          <dd>{stageLabel}</dd>
        </div>
      </dl>
    </SurfacePanel>
  );
};
