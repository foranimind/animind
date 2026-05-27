import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { JSX } from "react";

describe("App lazy welcome route", () => {
  it("does not load the welcome page module when rendering the studio route", async () => {
    vi.resetModules();
    vi.doMock("../pages/WelcomePage", () => {
      throw new Error("WelcomePage should not be imported for /studio");
    });

    const { App } = await import("../App");

    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <App />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "创作台" }, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  it("renders a visible loading shell while the welcome route chunk is still pending", async () => {
    vi.resetModules();
    let resolveModule:
      | ((value: { WelcomePage: () => JSX.Element }) => void)
      | undefined;
    const modulePromise = new Promise<{ WelcomePage: () => JSX.Element }>((resolve) => {
      resolveModule = resolve;
    });

    vi.doMock("../pages/WelcomePage", () => modulePromise);

    const { App } = await import("../App");

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("status", { name: "正在加载页面" })
    ).toBeInTheDocument();

    resolveModule?.({
      WelcomePage: () => <h1>Animind Studio</h1>,
    });

    expect(await screen.findByRole("heading", { name: "Animind Studio" })).toBeInTheDocument();
  });
});
