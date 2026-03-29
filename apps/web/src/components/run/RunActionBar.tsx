import { ActionButton } from "../ui/ActionButton";
import { SurfacePanel } from "../ui/SurfacePanel";

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
  <SurfacePanel
    tone="muted"
    className="run-card run-action-bar"
    header={<h2 className="run-card-title">控制</h2>}
  >
    <ActionButton
      disabled={!canCancel || isCanceling}
      onClick={onCancel}
      variant="danger"
    >
      {isCanceling ? "取消中..." : "取消生成"}
    </ActionButton>
  </SurfacePanel>
);
