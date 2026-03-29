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
  const variant = props.variant ?? "primary";
  const className = joinClasses("ui-button", `ui-button-${variant}`, props.className);

  if ("href" in props && props.href) {
    const { href, children, className: _className, variant: _variant, ...anchorProps } =
      props as Extract<ActionButtonProps, { href: string }>;
    return (
      <a {...anchorProps} href={href} className={className}>
        {children}
      </a>
    );
  }

  const { children, className: _className, variant: _variant, ...buttonProps } =
    props as Extract<ActionButtonProps, { href?: undefined }>;
  const buttonType = buttonProps.type as "button" | "submit" | "reset" | undefined;
  return (
    <button {...buttonProps} type={buttonType ?? "button"} className={className}>
      {children}
    </button>
  );
};
