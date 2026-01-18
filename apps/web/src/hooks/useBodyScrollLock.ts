import { useEffect } from "react";

let activeLocks = 0;
let previousOverflow: string | null = null;

export const useBodyScrollLock = (active: boolean) => {
  useEffect(() => {
    if (!active || typeof document === "undefined") {
      return;
    }
    if (activeLocks === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    activeLocks += 1;
    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks === 0) {
        document.body.style.overflow = previousOverflow ?? "";
        previousOverflow = null;
      }
    };
  }, [active]);
};
