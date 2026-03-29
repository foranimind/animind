import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  accessory?: ReactNode;
  className?: string;
};

const joinClasses = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(" ");

export const PageHeader = ({
  eyebrow,
  title,
  description,
  accessory,
  className,
}: PageHeaderProps) => (
  <header className={joinClasses("page-header-block", className)}>
    <div className="page-header-copy">
      {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
      <h1 className="page-title">{title}</h1>
      {description ? <p className="page-description">{description}</p> : null}
    </div>
    {accessory ? <div className="page-header-accessory">{accessory}</div> : null}
  </header>
);
