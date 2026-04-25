import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppLoadingShell } from "../components/layout/AppLoadingShell";

describe("frontend branding", () => {
  it("shows Motionverse Studio in the loading shell eyebrow", () => {
    render(<AppLoadingShell />);

    expect(screen.getByText("Motionverse Studio")).toBeInTheDocument();
  });

  it("uses Motionverse Studio in the HTML title template", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain("<title>Motionverse Studio</title>");
  });
});
