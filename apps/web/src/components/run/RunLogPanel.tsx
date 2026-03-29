type RunLogPanelProps = {
  lines: string[];
};

export const RunLogPanel = ({ lines }: RunLogPanelProps) => (
  <section className="run-panel">
    <div className="run-panel-header">
      <h2>执行日志</h2>
    </div>

    <ul className="run-log-list">
      {(lines.length > 0 ? lines : ["等待日志输出..."]).map((line, index) => (
        <li key={`${index}-${line}`}>{line}</li>
      ))}
    </ul>
  </section>
);
