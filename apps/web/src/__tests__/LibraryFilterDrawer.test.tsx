import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LibraryFilterDrawer } from "../components/library/LibraryFilterDrawer";

const OPTIONS = [{ value: "all", label: "All" }];

const renderDrawer = (onClose: () => void, open = true) =>
  render(
    <div>
      <button data-filter-trigger="library-filters">trigger</button>
      <LibraryFilterDrawer
        open={open}
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

  it("does not mount drawer controls when closed", () => {
    const { container } = renderDrawer(vi.fn(), false);

    expect(container.querySelector(".library-drawer-close")).toBeNull();
    expect(container.querySelector(".library-filter-panel")).toBeNull();
  });

  it("moves focus into the drawer and traps tab navigation while open", async () => {
    const user = userEvent.setup();
    const { container } = renderDrawer(vi.fn(), true);

    await waitFor(() => expect(screen.getByRole("button", { name: "关闭筛选" })).toHaveFocus());

    const drawer = container.querySelector(".library-drawer") as HTMLElement;
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();

    expect(drawer.contains(document.activeElement)).toBe(true);
  });

  it("restores focus to the filter trigger when closed", async () => {
    const user = userEvent.setup();
    const ControlledDrawer = () => {
      const [open, setOpen] = useState(true);
      return (
        <div>
          <button data-filter-trigger="library-filters">trigger</button>
          <LibraryFilterDrawer
            open={open}
            onClose={() => setOpen(false)}
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
    };

    const { container } = render(<ControlledDrawer />);
    const trigger = screen.getByRole("button", { name: "trigger" });

    await waitFor(() => expect(screen.getByRole("button", { name: "关闭筛选" })).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "关闭筛选" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(container.querySelector(".library-drawer-close")).toBeNull();
  });
});
