import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppLoadingShell } from "../components/layout/AppLoadingShell";

describe("frontend branding", () => {
  it("shows Animind Studio in the loading shell eyebrow", () => {
    render(<AppLoadingShell />);

    expect(screen.getByText("Animind Studio")).toBeInTheDocument();
  });

  it("uses Animind Studio in the HTML title template", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain("<title>Animind Studio</title>");
  });
});
