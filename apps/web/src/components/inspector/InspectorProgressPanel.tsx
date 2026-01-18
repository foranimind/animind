type InspectorProgressPanelProps = {
  progressStage: string;
  progressLabel: string;
  progressValue: number;
  queueLabel: string;
  logLines: string[];
  actionLabel?: string;
  onComplete: () => void;
  onCancel?: () => void;
  isCanceling?: boolean;
  canCancel?: boolean;
};

export const InspectorProgressPanel = ({
  progressStage,
  progressLabel,
  progressValue,
  queueLabel,
  logLines,
  actionLabel = "查看结果",
  onComplete,
  onCancel,
  isCanceling = false,
  canCancel = true,
}: InspectorProgressPanelProps) => (
  <>
    <div className="inspector-progress">
      <div className="progress-header">
        <div>
          <div className="progress-title">生成进度</div>
          <div className="progress-subtitle">阶段：{progressStage}</div>
          <div className="progress-meta">队列位置：{queueLabel}</div>
        </div>
        <div className="progress-value">{progressLabel}</div>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progressValue}%` }} />
      </div>
    </div>

    <div className="log-panel">
      <div className="log-panel-title">实时日志</div>
      <ul className="log-list">
        {logLines.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ul>
    </div>

    <div className="progress-actions">
      {onCancel ? (
        <button
          type="button"
          className="ghost-button danger"
          onClick={onCancel}
          disabled={!canCancel || isCanceling}
        >
          <span>{isCanceling ? "取消中..." : "取消生成"}</span>
        </button>
      ) : null}
      <button type="button" className="ghost-button" onClick={onComplete}>
        <span>{actionLabel}</span>
        <svg className="button-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M4 10h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M10 5l5 5-5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  </>
);
