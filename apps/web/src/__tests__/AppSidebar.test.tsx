import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AppSidebar } from "../components/sidebar/AppSidebar";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { saveSessionDetail, setActiveSessionId } from "../lib/storage";

describe("AppSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders canceled status class for sessions", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-canceled", now);
    detail.status = "canceled";
    detail.lastPrompt = "Canceled scene";

    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    const sessionButton = screen.getByRole("button", { name: "Canceled scene" });
    expect(sessionButton).toHaveClass("session-status-canceled");
  });
});
