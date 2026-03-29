import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionButton } from "../components/ui/ActionButton";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";

describe("ui primitives", () => {
  it("renders button variants and disabled state consistently", () => {
    render(
      <>
        <ActionButton variant="primary">开始生成</ActionButton>
        <ActionButton variant="ghost" disabled>
          次按钮
        </ActionButton>
      </>
    );

    expect(screen.getByRole("button", { name: "开始生成" })).toHaveClass(
      "ui-button",
      "ui-button-primary"
    );
    expect(screen.getByRole("button", { name: "次按钮" })).toBeDisabled();
  });

  it("renders status pills and page headers with stable classes", () => {
    render(
      <>
        <StatusPill tone="ready">完成</StatusPill>
        <PageHeader eyebrow="Delivery" title="交付结果" description="结果已经准备好。" />
      </>
    );

    expect(screen.getByText("完成")).toHaveClass("status-pill", "status-pill-ready");
    expect(screen.getByRole("heading", { name: "交付结果" })).toBeInTheDocument();
    expect(screen.getByText("Delivery")).toHaveClass("page-eyebrow");
  });
});
