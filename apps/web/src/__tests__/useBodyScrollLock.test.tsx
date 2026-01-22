import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

const LockProbe = ({ active }: { active: boolean }) => {
  useBodyScrollLock(active);
  return null;
};

const Wrapper = ({ first, second }: { first: boolean; second: boolean }) => (
  <>
    <LockProbe active={first} />
    <LockProbe active={second} />
  </>
);

describe("useBodyScrollLock", () => {
  it("locks and restores body overflow", () => {
    document.body.style.overflow = "auto";
    const { rerender, unmount } = render(<LockProbe active />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<LockProbe active={false} />);
    expect(document.body.style.overflow).toBe("auto");
    unmount();
  });

  it("keeps lock until all instances release", () => {
    document.body.style.overflow = "auto";
    const { rerender, unmount } = render(<Wrapper first second />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Wrapper first={false} second />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Wrapper first={false} second={false} />);
    expect(document.body.style.overflow).toBe("auto");
    unmount();
  });
});
