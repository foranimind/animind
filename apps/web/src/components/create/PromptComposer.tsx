import type { ReactNode } from "react";

import { ActionButton } from "../ui/ActionButton";
import { SurfacePanel } from "../ui/SurfacePanel";

type PromptComposerProps = {
  draft: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  helperBar?: ReactNode;
};

export const PromptComposer = ({
  draft,
  canSubmit,
  isSubmitting,
  onDraftChange,
  onSubmit,
  helperBar,
}: PromptComposerProps) => (
  <SurfacePanel
    tone="hero"
    className="prompt-composer-panel"
    header={
      <div className="prompt-composer-header">
        <div>
          <h2 className="prompt-composer-title">开始新的生成任务</h2>
          <p className="prompt-composer-subtitle">
            把镜头、光线、动作和配乐组织成一条清晰的创作描述。
          </p>
        </div>
      </div>
    }
  >
    <label className="prompt-composer-label" htmlFor="prompt-composer">
      创作描述
    </label>
    <textarea
      id="prompt-composer"
      className="prompt-composer-input"
      value={draft}
      rows={8}
      placeholder="描述你的场景、光线、动作与配乐..."
      onChange={(event) => onDraftChange(event.target.value)}
    />

    {helperBar}

    <div className="prompt-composer-actions">
      <ActionButton
        className="prompt-composer-submit"
        disabled={!canSubmit || isSubmitting}
        onClick={onSubmit}
      >
        {isSubmitting ? "创建中..." : "开始生成"}
      </ActionButton>
    </div>
  </SurfacePanel>
);
