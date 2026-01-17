type InspectorProgressPanelProps = {
  progressStage: string;
  progressLabel: string;
  progressValue: number;
  queueLabel: string;
  logLines: string[];
  onComplete: () => void;
};

export const InspectorProgressPanel = ({
  progressStage,
  progressLabel,
  progressValue,
  queueLabel,
  logLines,
  onComplete,
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

    <button type="button" className="ghost-button" onClick={onComplete}>
      <span>查看结果</span>
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
  </>
);
