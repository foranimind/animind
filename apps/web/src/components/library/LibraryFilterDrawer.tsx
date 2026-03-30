import { useCallback, useEffect, useRef } from "react";

import { LibraryFilters, type FilterOption } from "./LibraryFilters";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useDismissable } from "../../hooks/useDismissable";

type LibraryFilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  style: string;
  duration: string;
  date: string;
  styleOptions: FilterOption[];
  durationOptions: FilterOption[];
  dateOptions: FilterOption[];
  onStyleChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onClear: () => void;
};

export const LibraryFilterDrawer = ({
  open,
  onClose,
  style,
  duration,
  date,
  styleOptions,
  durationOptions,
  dateOptions,
  onStyleChange,
  onDurationChange,
  onDateChange,
  onClear,
}: LibraryFilterDrawerProps) => {
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const shouldDismiss = useCallback((event: MouseEvent | KeyboardEvent) => {
    if ("key" in event) {
      return true;
    }
    const target = event.target as HTMLElement | null;
    return !target?.closest?.("[data-filter-trigger='library-filters']");
  }, []);

  useDismissable({
    enabled: open,
    refs: panelRef,
    onDismiss: onClose,
    shouldDismiss,
  });
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      return;
    }
    previousFocusRef.current =
      document.querySelector<HTMLElement>("[data-filter-trigger='library-filters']") ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const focusableSelectors = [
        "button:not([disabled])",
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(", ");
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelectors));
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey) {
        if (activeElement === first || !panel.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const trigger = previousFocusRef.current?.isConnected
        ? previousFocusRef.current
        : document.querySelector<HTMLElement>("[data-filter-trigger='library-filters']");
      trigger?.focus?.();
      previousFocusRef.current = null;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="library-drawer open" id="library-filters-drawer">
      <div className="library-drawer-overlay" role="presentation" />
      <aside
        className="library-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="作品筛选"
        ref={panelRef}
      >
        <header className="library-drawer-header">
          <div>
            <div className="library-drawer-title">作品筛选</div>
            <div className="library-drawer-subtitle">细化作品筛选条件。</div>
          </div>
          <button
            type="button"
            className="library-drawer-close"
            onClick={onClose}
            aria-label="关闭筛选"
            ref={closeButtonRef}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                d="M4 4l8 8M12 4l-8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <LibraryFilters
          style={style}
          duration={duration}
          date={date}
          styleOptions={styleOptions}
          durationOptions={durationOptions}
          dateOptions={dateOptions}
          onStyleChange={onStyleChange}
          onDurationChange={onDurationChange}
          onDateChange={onDateChange}
          onClear={onClear}
        />
      </aside>
    </div>
  );
};
