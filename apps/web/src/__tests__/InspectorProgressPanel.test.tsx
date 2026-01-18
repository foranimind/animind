import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InspectorProgressPanel } from "../components/inspector/InspectorProgressPanel";

describe("InspectorProgressPanel", () => {
  it("renders cancel button state when canceling", () => {
    render(
      <InspectorProgressPanel
        progressStage="Planning"
        progressLabel="10%"
        progressValue={10}
        queueLabel="--"
        logLines={["step"]}
        actionLabel="Resume"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        isCanceling
        canCancel={false}
      />
    );

    const cancelButton = screen.getByRole("button", { name: "\u53d6\u6d88\u4e2d..." });
    expect(cancelButton).toBeDisabled();

    const actionButton = screen.getByRole("button", { name: "Resume" });
    expect(actionButton).toBeEnabled();
  });
});
