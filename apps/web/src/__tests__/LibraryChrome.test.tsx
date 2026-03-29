import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LibraryPage } from "../pages/LibraryPage";

describe("LibraryPage chrome", () => {
  it("exposes the command region and localized filter drawer controls", async () => {
    const user = userEvent.setup();

    render(<LibraryPage />);

    expect(screen.getByRole("region", { name: "作品命令条" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "筛选" }));

    expect(screen.getByRole("dialog", { name: "作品筛选" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭筛选" })).toBeInTheDocument();
  });
});
