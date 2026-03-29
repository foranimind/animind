const HELPER_SNIPPETS = [
  { label: "镜头", value: "镜头：" },
  { label: "光线", value: "光线：" },
  { label: "动作", value: "动作：" },
  { label: "配乐", value: "配乐：" },
];

type PromptHelperBarProps = {
  onInsert: (value: string) => void;
};

export const PromptHelperBar = ({ onInsert }: PromptHelperBarProps) => (
  <section className="prompt-helper-bar" aria-label="Prompt helper">
    {HELPER_SNIPPETS.map(({ label, value }) => (
      <button
        key={label}
        type="button"
        className="helper-chip"
        onClick={() => onInsert(value)}
      >
        {label}
      </button>
    ))}
  </section>
);
