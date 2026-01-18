import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkCard } from "../components/library/WorkCard";

describe("WorkCard", () => {
  it("closes action menu on outside click", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <WorkCard
        jobId="job-1"
        title="Test work"
        onRemove={vi.fn()}
      />
    );

    const button = container.querySelector(".work-card-action-button");
    if (!button) {
      throw new Error("Missing action button");
    }
    await user.click(button);
    expect(container.querySelector(".work-card-menu.open")).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(container.querySelector(".work-card-menu.open")).toBeFalsy();
  });

  it("renders status label and tone for completed work", () => {
    render(
      <WorkCard
        jobId="job-2"
        title="Done work"
        status="DONE"
        onRemove={vi.fn()}
      />
    );
    const status = screen.getByText("\u5b8c\u6210");
    expect(status).toBeInTheDocument();
    expect(status).toHaveClass("work-card-status");
    expect(status).toHaveClass("ready");
  });
});
