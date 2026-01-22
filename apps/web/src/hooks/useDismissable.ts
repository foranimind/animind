import { useEffect, type RefObject } from "react";

type DismissableRefs =
  | RefObject<HTMLElement | null>
  | Array<RefObject<HTMLElement | null>>;

type UseDismissableOptions = {
  enabled?: boolean;
  refs?: DismissableRefs;
  onDismiss: () => void;
  onEscape?: () => void;
  shouldDismiss?: (event: MouseEvent | KeyboardEvent) => boolean;
};

const resolveRefs = (refs?: DismissableRefs): Array<RefObject<HTMLElement | null>> => {
  if (!refs) {
    return [];
  }
  return Array.isArray(refs) ? refs : [refs];
};

export const useDismissable = ({
  enabled = true,
  refs,
  onDismiss,
  onEscape,
  shouldDismiss,
}: UseDismissableOptions) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const refList = resolveRefs(refs);
    const isInside = (target: Node | null) =>
      Boolean(target && refList.some((ref) => ref.current?.contains(target)));
    const handlePointer = (event: MouseEvent) => {
      if (isInside(event.target as Node | null)) {
        return;
      }
      if (shouldDismiss && !shouldDismiss(event)) {
        return;
      }
      onDismiss();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (shouldDismiss && !shouldDismiss(event)) {
        return;
      }
      (onEscape ?? onDismiss)();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onDismiss, onEscape, refs, shouldDismiss]);
};
