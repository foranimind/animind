import type { ComponentPropsWithoutRef, ReactNode } from "react";

type SurfaceTone = "default" | "muted" | "hero";

type SurfacePanelProps = ComponentPropsWithoutRef<"section"> & {
  tone?: SurfaceTone;
  header?: ReactNode;
  bodyClassName?: string;
};

const joinClasses = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(" ");

export const SurfacePanel = ({
  tone = "default",
  header,
  className,
  bodyClassName,
  children,
  ...props
}: SurfacePanelProps) => (
  <section {...props} className={joinClasses("surface-panel", `surface-panel-${tone}`, className)}>
    {header ? <div className="surface-panel-header">{header}</div> : null}
    <div className={joinClasses("surface-panel-body", bodyClassName)}>{children}</div>
  </section>
);
