import { Link } from "react-router-dom";

import type { WelcomeStageSceneContent } from "./welcomeContent";

type WelcomeEndcapSceneProps = {
  primaryHref: string;
  primaryLabel: string;
  scene: WelcomeStageSceneContent;
};

export const WelcomeEndcapScene = ({
  primaryHref,
  primaryLabel,
  scene,
}: WelcomeEndcapSceneProps) => {
  return (
    <div className="welcome-endcap-layout">
      <div className="welcome-endcap-copy">
        <p className="welcome-endcap-eyebrow">{scene.eyebrow}</p>
        <h2 className="welcome-endcap-title">{scene.title}</h2>
        <p className="welcome-endcap-description">{scene.description}</p>
      </div>

      <div className="welcome-endcap-cta-row">
        <Link className="ui-button ui-button-primary welcome-endcap-cta" to={primaryHref}>
          {primaryLabel}
        </Link>
      </div>
    </div>
  );
};
