import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "danger";

type ActionButtonProps =
  | ({
      href?: undefined;
      variant?: ButtonVariant;
      children: ReactNode;
    } & ButtonHTMLAttributes<HTMLButtonElement>)
  | ({
      href: string;
      variant?: ButtonVariant;
      children: ReactNode;
    } & AnchorHTMLAttributes<HTMLAnchorElement>);

const joinClasses = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(" ");

export const ActionButton = (props: ActionButtonProps) => {
  if ("href" in props) {
    const { href, children, className, variant, ...anchorProps } =
      props as Extract<ActionButtonProps, { href: string }>;
    const resolvedClassName = joinClasses(
      "ui-button",
      `ui-button-${variant ?? "primary"}`,
      className
    );
    return (
      <a {...anchorProps} href={href} className={resolvedClassName}>
        {children}
      </a>
    );
  }

  const { children, className, variant, ...buttonProps } =
    props as Extract<ActionButtonProps, { href?: undefined }>;
  const resolvedClassName = joinClasses(
    "ui-button",
    `ui-button-${variant ?? "primary"}`,
    className
  );
  const buttonType = buttonProps.type as "button" | "submit" | "reset" | undefined;
  return (
    <button {...buttonProps} type={buttonType ?? "button"} className={resolvedClassName}>
      {children}
    </button>
  );
};
