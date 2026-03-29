export type StatusTone = "ready" | "loading" | "warning" | "error" | "idle" | "unknown";

type StatusLabelVariant = "stage" | "card";

const JOB_STATUS_LABELS: Record<string, { stage?: string; card?: string }> = {
  queued: { stage: "排队中", card: "排队中" },
  planning: { stage: "规划", card: "规划中" },
  running: { card: "生成中" },
  running_motion: { stage: "动作", card: "动作生成" },
  running_scene: { stage: "场景", card: "场景生成" },
  running_music: { stage: "音乐", card: "音乐生成" },
  composing_preview: { stage: "预览合成", card: "合成预览" },
  exporting_video: { stage: "导出", card: "导出中" },
  done: { stage: "完成", card: "完成" },
  completed: { card: "完成" },
  success: { card: "完成" },
  failed: { stage: "失败", card: "失败" },
  canceled: { stage: "已取消", card: "已取消" },
  error: { stage: "错误", card: "错误" },
  loading: { card: "加载中" },
  unknown: { card: "未知" },
};

const READY_STATUSES = new Set(["done", "completed", "success"]);

const normalizeStatusKey = (value?: string) => value?.toLowerCase() ?? "";

const getJobStatusLabel = (
  value: string | undefined,
  variant: StatusLabelVariant
): string | undefined => {
  const key = normalizeStatusKey(value);
  if (!key) {
    return undefined;
  }
  return JOB_STATUS_LABELS[key]?.[variant];
};

const formatStatusFallbackLabel = (value: string) =>
  value.replace(/_/g, " ").replace(/^\w/, (match) => match.toUpperCase());

export const resolveJobStageLabel = (stage?: string, status?: string): string => {
  const stageLabel = getJobStatusLabel(stage, "stage");
  if (stageLabel) {
    return stageLabel;
  }
  if (stage) {
    return stage;
  }
  const statusLabel = getJobStatusLabel(status, "stage");
  if (statusLabel) {
    return statusLabel;
  }
  return status ?? "准备中";
};

type WorkStatusArgs = {
  status?: string;
  loading?: boolean;
  error?: string;
};

export const getWorkStatusDisplay = ({
  status,
  loading,
  error,
}: WorkStatusArgs): { label: string; tone: StatusTone; hasStatus: boolean } => {
  const normalizedStatus = normalizeStatusKey(status);
  const rawStatus = error ? "error" : loading ? "loading" : normalizedStatus || "unknown";
  const label = getJobStatusLabel(rawStatus, "card") ?? formatStatusFallbackLabel(rawStatus);
  const hasStatus = Boolean(error || loading || normalizedStatus);
  const tone: StatusTone = error
    ? "error"
    : loading
      ? "loading"
      : READY_STATUSES.has(normalizedStatus)
        ? "ready"
        : normalizedStatus
          ? "idle"
          : "unknown";
  return { label, tone, hasStatus };
};

type AsyncStatus = "idle" | "loading" | "ready" | "error";

type WorkDetailStatusArgs = {
  manifestStatus: AsyncStatus;
  previewStatus: AsyncStatus;
  manifestNotFound?: boolean;
};

export const getWorkDetailStatusInfo = ({
  manifestStatus,
  previewStatus,
  manifestNotFound,
}: WorkDetailStatusArgs): { label: string; tone: StatusTone } => {
  if (manifestStatus === "loading") {
    return { label: "Loading", tone: "loading" };
  }
  if (manifestStatus === "error") {
    return { label: manifestNotFound ? "Not found" : "Error", tone: "error" };
  }
  if (manifestStatus === "ready" && previewStatus === "loading") {
    return { label: "Preview loading", tone: "loading" };
  }
  if (previewStatus === "error") {
    return { label: "Preview issue", tone: "warning" };
  }
  if (manifestStatus === "ready") {
    return { label: "Ready", tone: "ready" };
  }
  return { label: "Idle", tone: "idle" };
};
