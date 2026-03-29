import type { SessionMessage, SessionRecovery } from "../../lib/storage";

type RecoveredContextPanelProps = {
  recovery?: SessionRecovery;
  messages: SessionMessage[];
};

export const RecoveredContextPanel = ({
  recovery,
  messages,
}: RecoveredContextPanelProps) => {
  if (!recovery) {
    return null;
  }

  const compactHistory = messages.filter((item) => item.role !== "tool").slice(-4);

  return (
    <section className="recovered-context-card">
      <div className={`recovery-banner recovery-${recovery.reason}`}>
        <strong>{recovery.reason === "canceled" ? "任务已取消" : "生成失败"}</strong>
        <span>{recovery.message ?? "请调整输入后重试。"}</span>
      </div>

      {compactHistory.length > 0 ? (
        <div className="recovery-history">
          <div className="recovery-history-title">已恢复上下文</div>
          <ul className="compact-history-list">
            {compactHistory.map((item) => (
              <li key={item.id}>{item.content}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
