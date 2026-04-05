import { Link } from "react-router-dom";

import { SplitRevealText } from "./SplitRevealText";
import type { WelcomeStageSceneContent } from "./welcomeContent";

type HeroIntroProps = {
  mobile?: boolean;
  prefersReducedMotion: boolean;
  primaryHref: string;
  primaryLabel: string;
  runningHref?: string;
  scene: WelcomeStageSceneContent;
};

export const HeroIntro = ({
  mobile = false,
  prefersReducedMotion,
  primaryHref,
  primaryLabel,
  runningHref,
  scene,
}: HeroIntroProps) => {
  const splitTitleCharacters = !(prefersReducedMotion || mobile);

  return (
    <div className="welcome-hero-layout">
      <div className="welcome-hero-copy" data-stage-role="portal-copy">
        <SplitRevealText
          as="p"
          className="welcome-eyebrow"
          text={scene.eyebrow}
          prefersReducedMotion={prefersReducedMotion}
          delayStepMs={14}
        />
        <SplitRevealText
          as="h1"
          className="welcome-title"
          text={scene.title}
          prefersReducedMotion={!splitTitleCharacters}
          initialDelayMs={40}
          delayStepMs={22}
        />
        {scene.subtitle ? (
          <SplitRevealText
            as="p"
            className="welcome-subtitle"
            text={scene.subtitle}
            prefersReducedMotion={prefersReducedMotion}
            initialDelayMs={140}
            delayStepMs={10}
          />
        ) : null}
        <SplitRevealText
          as="p"
          className="welcome-description"
          text={scene.description}
          prefersReducedMotion={prefersReducedMotion}
          initialDelayMs={220}
          delayStepMs={8}
        />
      </div>

      <div className="welcome-cta-row">
        <Link className="ui-button ui-button-primary welcome-cta" to={primaryHref}>
          {primaryLabel}
        </Link>
        {runningHref ? (
          <Link className="ui-button ui-button-ghost welcome-cta" to={runningHref}>
            查看进行中的任务
          </Link>
        ) : null}
      </div>
    </div>
  );
};
