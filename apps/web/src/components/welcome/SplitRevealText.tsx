import type { CSSProperties, ComponentPropsWithoutRef } from "react";

type SplitRevealAs = "p" | "h1" | "h2" | "h3" | "span" | "div";

type SplitRevealTextProps = {
  as?: SplitRevealAs;
  className?: string;
  text: string;
  prefersReducedMotion: boolean;
  delayStepMs?: number;
  initialDelayMs?: number;
} & Omit<ComponentPropsWithoutRef<SplitRevealAs>, "children" | "className">;

const joinClasses = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(" ");

export const SplitRevealText = ({
  as,
  className,
  text,
  prefersReducedMotion,
  delayStepMs = 18,
  initialDelayMs = 0,
  ...props
}: SplitRevealTextProps) => {
  const Component: SplitRevealAs = as ?? "span";

  if (prefersReducedMotion) {
    return (
      <Component {...props} className={className}>
        {text}
      </Component>
    );
  }

  return (
    <Component
      {...props}
      aria-label={text}
      className={joinClasses("split-reveal-text", className)}
    >
      {Array.from(text).map((character, index) => (
        <span
          key={`${character}-${index}`}
          className="split-reveal-char"
          data-reveal-char="true"
          style={{ animationDelay: `${initialDelayMs + index * delayStepMs}ms` } as CSSProperties}
        >
          {character}
        </span>
      ))}
    </Component>
  );
};
