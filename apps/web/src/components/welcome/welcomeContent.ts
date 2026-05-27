import type { WelcomeStageSceneId } from "./welcomeStageTimeline";

export type WelcomeStoryStageLayout = "gather" | "engine" | "delivery";

export type WelcomeStageSceneContent = {
  id: WelcomeStageSceneId;
  kind: "hero" | "story" | "endcap";
  eyebrow: string;
  title: string;
  subtitle?: string;
  description: string;
  bullets?: string[];
  ctaLabel?: string;
  stageLayout?: WelcomeStoryStageLayout;
};

export const WELCOME_STAGE_SCENES: WelcomeStageSceneContent[] = [
  {
    id: "hero",
    kind: "hero",
    eyebrow: "欢迎回来",
    title: "Animind Studio",
    subtitle: "从灵感、任务到生成结果，欢迎页先帮你看懂整个工作流。",
    description:
      "先了解故事结构，再决定是否继续上一次的创作，或者直接进入工作室开启新的项目。",
  },
  {
    id: "story-1",
    kind: "story",
    eyebrow: "Chapter 01",
    title: "从想法到任务",
    description:
      "把模糊的灵感整理成清晰的创作起点，让每一次进入工作室都知道下一步该做什么。",
    bullets: ["识别创意方向", "确认任务目标", "进入创作台开始编排"],
    stageLayout: "gather",
  },
  {
    id: "story-2",
    kind: "story",
    eyebrow: "Chapter 02",
    title: "从任务到生成过程",
    description:
      "任务进入执行后，系统会持续推进生成流程，并保留可继续接续的会话状态。",
    bullets: ["保持当前会话上下文", "追踪任务执行状态", "必要时回到正在进行的工作"],
    stageLayout: "engine",
  },
  {
    id: "story-3",
    kind: "story",
    eyebrow: "Chapter 03",
    title: "从结果到交付",
    description:
      "完成后的结果会回到可交付的成果阶段，方便预览、整理与后续使用。",
    bullets: ["查看最终产物", "进入成果交付页面", "继续管理历史作品"],
    stageLayout: "delivery",
  },
  {
    id: "endcap",
    kind: "endcap",
    eyebrow: "结束之前",
    title: "准备好开始创作了吗",
    description: "如果你已经看完故事结构，可以直接进入工作室开始新的项目。",
    ctaLabel: "进入创作台",
  },
];
