import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WELCOME_STORY_SECTION_CSS = readFileSync(
  resolve(process.cwd(), "src/components/welcome/welcomeStorySection.css"),
  "utf8"
);
const WELCOME_PAGE_CSS = readFileSync(
  resolve(process.cwd(), "src/pages/welcome.css"),
  "utf8"
);

describe("welcomeStorySection styles", () => {
  it("does not render a duplicate lower beam in the engine visual", () => {
    expect(WELCOME_STORY_SECTION_CSS).not.toContain(".welcome-stage-visual--engine::after");
  });

  it("keeps the engine beta module above the lower rail", () => {
    expect(WELCOME_STORY_SECTION_CSS).toContain(".welcome-stage-visual__module--beta");
    expect(WELCOME_STORY_SECTION_CSS).toContain("bottom: 28%;");
    expect(WELCOME_STORY_SECTION_CSS).not.toContain(".welcome-stage-visual__module--beta {\n  bottom: 18%;");
  });

  it("does not stack a second beam under the delivery surface arrow", () => {
    expect(WELCOME_STORY_SECTION_CSS).not.toContain(".welcome-stage-visual--delivery::after");
  });

  it("gives the delivery panel enough width to avoid a cramped text column", () => {
    expect(WELCOME_STORY_SECTION_CSS).not.toContain("minmax(320px, 0.42fr)");
    expect(WELCOME_STORY_SECTION_CSS).toContain("minmax(380px, 0.58fr)");
  });

  it("uses the same Newsreader title family across the welcome story scenes", () => {
    expect(WELCOME_STORY_SECTION_CSS).toContain('font-family: "Newsreader", serif;');
    expect(WELCOME_PAGE_CSS).toContain('font-family: "Newsreader", serif;');
    expect(WELCOME_PAGE_CSS).toContain("-webkit-text-fill-color: transparent;");
  });

  it("expands the welcome page title line boxes so serif caps are not clipped", () => {
    expect(WELCOME_PAGE_CSS).toContain("padding-block-start: 0.08em;");
    expect(WELCOME_PAGE_CSS).toContain("padding-block-end: 0.04em;");
    expect(WELCOME_PAGE_CSS).toContain("line-height: 0.92;");
  });

  it("expands the story title line boxes so serif caps are not clipped", () => {
    expect(WELCOME_STORY_SECTION_CSS).toContain("padding-block-start: 0.08em;");
    expect(WELCOME_STORY_SECTION_CSS).toContain("padding-block-end: 0.04em;");
    expect(WELCOME_STORY_SECTION_CSS).toContain("line-height: 0.92;");
  });
});
