import type { ReactElement } from "react";

import type {
  WelcomeStageSceneContent,
  WelcomeStoryStageLayout,
} from "./welcomeContent";

import "./welcomeStorySection.css";

type WelcomeStorySectionProps = {
  scene: WelcomeStageSceneContent;
};

const StageVisualGather = () => (
  <div className="welcome-stage-visual welcome-stage-visual--gather" aria-hidden="true">
    <div className="welcome-stage-visual__pulse welcome-stage-visual__pulse--outer" />
    <div className="welcome-stage-visual__pulse welcome-stage-visual__pulse--inner" />
    <div className="welcome-stage-visual__node welcome-stage-visual__node--alpha" />
    <div className="welcome-stage-visual__node welcome-stage-visual__node--beta" />
    <div className="welcome-stage-visual__node welcome-stage-visual__node--gamma" />
  </div>
);

const StageVisualEngine = () => (
  <div className="welcome-stage-visual welcome-stage-visual--engine" aria-hidden="true">
    <div className="welcome-stage-visual__grid" />
    <div className="welcome-stage-visual__rail welcome-stage-visual__rail--top" />
    <div className="welcome-stage-visual__rail welcome-stage-visual__rail--bottom" />
    <div className="welcome-stage-visual__module welcome-stage-visual__module--alpha" />
    <div className="welcome-stage-visual__module welcome-stage-visual__module--beta" />
  </div>
);

const StageVisualDelivery = () => (
  <div className="welcome-stage-visual welcome-stage-visual--delivery" aria-hidden="true">
    <div className="welcome-stage-visual__track" />
    <div className="welcome-stage-visual__card welcome-stage-visual__card--rear" />
    <div className="welcome-stage-visual__card welcome-stage-visual__card--front" />
    <div className="welcome-stage-visual__arrow" />
  </div>
);

type StageVisualComponent = () => ReactElement;

const STAGE_VISUAL_COMPONENTS: Record<WelcomeStoryStageLayout, StageVisualComponent> = {
  delivery: StageVisualDelivery,
  engine: StageVisualEngine,
  gather: StageVisualGather,
};

const StageVisual = ({ layout }: { layout: WelcomeStoryStageLayout }) => {
  const VisualComponent = STAGE_VISUAL_COMPONENTS[layout];

  return <VisualComponent />;
};

const StoryCopy = ({ scene }: { scene: WelcomeStageSceneContent }) => (
  <div className="welcome-story-copy">
    <p className="welcome-story-eyebrow">{scene.eyebrow}</p>
    <h2 className="welcome-story-title">{scene.title}</h2>
    <p className="welcome-story-description">{scene.description}</p>
  </div>
);

const StoryBullets = ({
  className,
  bullets,
}: {
  className: string;
  bullets?: string[];
}) => {
  if (!bullets?.length) {
    return null;
  }

  return (
    <ul className={className}>
      {bullets.map((bullet) => (
        <li key={bullet}>{bullet}</li>
      ))}
    </ul>
  );
};

const GatherComposition = ({ scene }: { scene: WelcomeStageSceneContent }) => (
  <div className="welcome-story-gather-layout">
    <div className="welcome-story-gather-copy">
      <StoryCopy scene={scene} />
    </div>
    <div className="welcome-story-gather-support">
      <StageVisual layout="gather" />
      <StoryBullets className="welcome-story-gather-notes" bullets={scene.bullets} />
    </div>
  </div>
);

const EngineComposition = ({ scene }: { scene: WelcomeStageSceneContent }) => (
  <div className="welcome-story-engine-layout">
    <div className="welcome-story-engine-visual-column">
      <StageVisual layout="engine" />
    </div>
    <aside className="welcome-story-engine-meta">
      <StoryCopy scene={scene} />
      <StoryBullets className="welcome-story-engine-checklist" bullets={scene.bullets} />
    </aside>
  </div>
);

const DeliveryComposition = ({ scene }: { scene: WelcomeStageSceneContent }) => (
  <div className="welcome-story-delivery-layout">
    <div className="welcome-story-delivery-surface">
      <StageVisual layout="delivery" />
      <div className="welcome-story-delivery-result">
        <p className="welcome-story-delivery-kicker">{scene.eyebrow}</p>
        <h2 className="welcome-story-delivery-title">{scene.title}</h2>
      </div>
    </div>
    <aside className="welcome-story-delivery-panel">
      <p className="welcome-story-description welcome-story-delivery-description">
        {scene.description}
      </p>
      <StoryBullets className="welcome-story-delivery-actions" bullets={scene.bullets} />
    </aside>
  </div>
);

type StoryLayoutComponent = ({
  scene,
}: {
  scene: WelcomeStageSceneContent;
}) => ReactElement;

const STORY_LAYOUT_COMPONENTS: Record<WelcomeStoryStageLayout, StoryLayoutComponent> = {
  delivery: DeliveryComposition,
  engine: EngineComposition,
  gather: GatherComposition,
};

export const WelcomeStorySection = ({
  scene,
}: WelcomeStorySectionProps) => {
  const layout = scene.stageLayout ?? "gather";
  const StoryComposition = STORY_LAYOUT_COMPONENTS[layout];

  return <StoryComposition scene={scene} />;
};
