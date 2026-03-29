type RunActionBarProps = {
  canCancel: boolean;
  isCanceling: boolean;
  onCancel: () => void;
};

export const RunActionBar = ({
  canCancel,
  isCanceling,
  onCancel,
}: RunActionBarProps) => (
  <section className="run-panel run-action-bar">
    <div className="run-panel-header">
      <h2>控制</h2>
    </div>

    <button
      type="button"
      className="danger-button"
      disabled={!canCancel || isCanceling}
      onClick={onCancel}
    >
      {isCanceling ? "取消中..." : "取消生成"}
    </button>
  </section>
);
