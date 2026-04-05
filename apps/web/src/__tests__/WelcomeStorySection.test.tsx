import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WelcomeStorySection } from "../components/welcome/WelcomeStorySection";
import { WELCOME_STAGE_SCENES } from "../components/welcome/welcomeContent";

const STORY_THREE_SCENE = WELCOME_STAGE_SCENES.find((scene) => scene.id === "story-3");

if (!STORY_THREE_SCENE) {
  throw new Error('Expected the welcome content to define the "story-3" scene.');
}

describe("WelcomeStorySection", () => {
  it("renders the delivery chapter with a single title owner and a side panel", () => {
    const { container } = render(<WelcomeStorySection scene={STORY_THREE_SCENE} />);

    const deliveryLayout = container.querySelector(".welcome-story-delivery-layout");

    expect(screen.getAllByText("从结果到交付")).toHaveLength(1);
    expect(deliveryLayout?.querySelector(".welcome-story-delivery-surface")).toBeInTheDocument();
    expect(deliveryLayout?.querySelector(".welcome-story-delivery-panel")).toBeInTheDocument();
    expect(deliveryLayout?.querySelector(".welcome-story-delivery-frame")).toBeNull();
  });
});
