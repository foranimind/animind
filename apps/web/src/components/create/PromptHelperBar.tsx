const HELPER_SNIPPETS = [
  "镜头：缓慢环绕主角",
  "光线：傍晚逆光与霓虹补光",
  "动作：角色抬头观察远处",
  "配乐：合成器氛围推进",
];

type PromptHelperBarProps = {
  onInsert: (value: string) => void;
};

export const PromptHelperBar = ({ onInsert }: PromptHelperBarProps) => (
  <section className="prompt-helper-bar" aria-label="Prompt helper">
    {HELPER_SNIPPETS.map((snippet) => (
      <button
        key={snippet}
        type="button"
        className="helper-chip"
        onClick={() => onInsert(snippet)}
      >
        {snippet}
      </button>
    ))}
  </section>
);
