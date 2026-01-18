import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LibraryFilterDrawer } from "../components/library/LibraryFilterDrawer";

const OPTIONS = [{ value: "all", label: "All" }];

const renderDrawer = (onClose: () => void) =>
  render(
    <div>
      <button data-filter-trigger="library-filters">trigger</button>
      <LibraryFilterDrawer
        open
        onClose={onClose}
        style="all"
        duration="any"
        date="any"
        styleOptions={OPTIONS}
        durationOptions={OPTIONS}
        dateOptions={OPTIONS}
        onStyleChange={() => undefined}
        onDurationChange={() => undefined}
        onDateChange={() => undefined}
        onClear={() => undefined}
      />
    </div>
  );

describe("LibraryFilterDrawer", () => {
  it("locks body scroll while open", async () => {
    document.body.style.overflow = "auto";
    const onClose = vi.fn();
    const { unmount } = renderDrawer(onClose);
    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("ignores clicks on the filter trigger", () => {
    const onClose = vi.fn();
    renderDrawer(onClose);
    const trigger = screen.getByText("trigger");
    fireEvent.mouseDown(trigger);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape and outside click", () => {
    const onClose = vi.fn();
    renderDrawer(onClose);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
