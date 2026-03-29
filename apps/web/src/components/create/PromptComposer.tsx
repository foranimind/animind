type PromptComposerProps = {
  draft: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
};

export const PromptComposer = ({
  draft,
  canSubmit,
  isSubmitting,
  onDraftChange,
  onSubmit,
}: PromptComposerProps) => (
  <section className="prompt-composer-card">
    <div className="prompt-composer-header">
      <div>
        <h1 className="prompt-composer-title">开始新的生成任务</h1>
        <p className="prompt-composer-subtitle">
          先整理场景描述，再直接发起任务。运行和交付状态由后续页面负责。
        </p>
      </div>
    </div>

    <label className="prompt-composer-label" htmlFor="prompt-composer">
      创作描述
    </label>
    <textarea
      id="prompt-composer"
      className="prompt-composer-input"
      value={draft}
      rows={6}
      placeholder="描述你的场景、光线、动作与配乐..."
      onChange={(event) => onDraftChange(event.target.value)}
    />

    <div className="prompt-composer-actions">
      <button
        type="button"
        className="primary-button"
        disabled={!canSubmit || isSubmitting}
        onClick={onSubmit}
      >
        <span>{isSubmitting ? "创建中..." : "开始生成"}</span>
      </button>
    </div>
  </section>
);
