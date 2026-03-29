import { SurfacePanel } from "../ui/SurfacePanel";

type RunLogPanelProps = {
  lines: string[];
};

export const RunLogPanel = ({ lines }: RunLogPanelProps) => (
  <SurfacePanel
    tone="muted"
    className="run-card run-log-panel"
    header={<h2 className="run-card-title">执行日志</h2>}
  >
    <ul className="run-log-list">
      {(lines.length > 0 ? lines : ["等待日志输出..."]).map((line, index) => (
        <li key={`${index}-${line}`}>{line}</li>
      ))}
    </ul>
  </SurfacePanel>
);
