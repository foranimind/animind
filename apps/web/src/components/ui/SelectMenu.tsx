import { useLayoutEffect, useRef, useState } from "react";

import { useDismissable } from "../../hooks/useDismissable";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectMenuProps = {
  value: string;
  options: SelectOption[];
  ariaLabel: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  panelClassName?: string;
};

const joinClasses = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(" ");

export const SelectMenu = ({
  value,
  options,
  ariaLabel,
  onChange,
  placeholder = "Select",
  className,
  panelClassName,
}: SelectMenuProps) => {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const [panelMaxHeight, setPanelMaxHeight] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useDismissable({
    enabled: open,
    refs: menuRef,
    onDismiss: () => setOpen(false),
  });

  useLayoutEffect(() => {
    if (!open) {
      setPanelMaxHeight(null);
      return;
    }
    const updatePlacement = () => {
      if (!triggerRef.current || !panelRef.current) {
        return;
      }
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const viewportGap = 12;
      const maxPanelHeight = 220;
      const availableBelow = window.innerHeight - triggerRect.bottom - viewportGap;
      const availableAbove = triggerRect.top - viewportGap;
      const naturalHeight = panelRef.current.scrollHeight;
      const shouldOpenUp =
        availableBelow < Math.min(maxPanelHeight, naturalHeight) && availableAbove > availableBelow;
      const availableSpace = shouldOpenUp ? availableAbove : availableBelow;
      setPlacement(shouldOpenUp ? "top" : "bottom");
      setPanelMaxHeight(Math.max(0, Math.min(maxPanelHeight, Math.floor(availableSpace))));
    };
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, options.length]);

  return (
    <div
      className={joinClasses(
        "select-menu",
        open && "open",
        placement === "top" && "top",
        className
      )}
      ref={menuRef}
    >
      <button
        type="button"
        className="select-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        ref={triggerRef}
      >
        <span>{selected?.label ?? placeholder}</span>
        <span className="select-caret" aria-hidden="true" />
      </button>
      {open && (
        <div
          className={joinClasses("select-panel", "ui-scrollbar", panelClassName)}
          role="listbox"
          aria-label={ariaLabel}
          ref={panelRef}
          style={panelMaxHeight !== null ? { maxHeight: `${panelMaxHeight}px` } : undefined}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`select-option${option.value === value ? " active" : ""}`}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span className="select-option-label">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
