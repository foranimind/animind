import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SelectMenu } from "../components/ui/SelectMenu";

describe("SelectMenu", () => {
  it("applies wrapper and panel class hooks", async () => {
    const user = userEvent.setup();
    const options = [
      { value: "a", label: "Option A" },
      { value: "b", label: "Option B" },
    ];
    const { container } = render(
      <SelectMenu
        value="a"
        options={options}
        ariaLabel="Classy select"
        className="library-filter-select"
        panelClassName="library-filter-select-panel"
        onChange={vi.fn()}
      />
    );

    expect(container.querySelector(".select-menu")).toHaveClass("library-filter-select");

    await user.click(screen.getByRole("button", { name: "Classy select" }));

    expect(screen.getByRole("listbox", { name: "Classy select" })).toHaveClass(
      "library-filter-select-panel"
    );
  });

  it("closes on Escape and outside click", async () => {
    const user = userEvent.setup();
    const options = [
      { value: "a", label: "Option A" },
      { value: "b", label: "Option B" },
    ];
    render(
      <SelectMenu
        value="a"
        options={options}
        ariaLabel="Test select"
        onChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole("button", { name: "Test select" });
    await user.click(trigger);
    expect(screen.getByRole("listbox", { name: "Test select" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("listbox", { name: "Test select" })
    ).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole("listbox", { name: "Test select" })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByRole("listbox", { name: "Test select" })
    ).not.toBeInTheDocument();
  });
});
