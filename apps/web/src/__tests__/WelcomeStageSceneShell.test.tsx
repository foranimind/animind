import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WelcomeStageSceneShell } from "../components/welcome/WelcomeStageSceneShell";

describe("WelcomeStageSceneShell", () => {
  it("fades exiting scenes instead of keeping them fully opaque", () => {
    const { container } = render(
      <WelcomeStageSceneShell
        contentLayer={2}
        sceneId="story-3"
        sceneState={{
          phase: "exit",
          progress: 0.7,
          titleProgress: 0.4,
          detailProgress: 0.3,
          intensity: 0.3,
          primary: false,
        }}
      >
        <div>scene</div>
      </WelcomeStageSceneShell>
    );

    expect(container.firstElementChild).toHaveStyle("opacity: 0.3");
  });

  it("uses pre-enter progress as the scene opacity for incoming content", () => {
    const { container } = render(
      <WelcomeStageSceneShell
        contentLayer={2}
        sceneId="story-2"
        sceneState={{
          phase: "pre-enter",
          progress: 0.25,
          titleProgress: 0.1,
          detailProgress: 0,
          intensity: 0.08,
          primary: false,
        }}
      >
        <div>scene</div>
      </WelcomeStageSceneShell>
    );

    expect(container.firstElementChild).toHaveStyle("opacity: 0.25");
  });
});
