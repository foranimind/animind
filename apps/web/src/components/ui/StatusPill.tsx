import type { HTMLAttributes } from "react";

import type { StatusTone } from "../../lib/status";

const joinClasses = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(" ");

type StatusPillProps = HTMLAttributes<HTMLSpanElement> & {
  tone: StatusTone;
};

export const StatusPill = ({ tone, className, children, ...props }: StatusPillProps) => (
  <span {...props} className={joinClasses("status-pill", `status-pill-${tone}`, className)}>
    <span className="status-pill-dot" aria-hidden="true" />
    {children}
  </span>
);
