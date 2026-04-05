import { Link } from "react-router-dom";

import type { WelcomeStageCtaMode } from "./welcomeStageTimeline";

type WelcomeStickyCtaProps = {
  mode: WelcomeStageCtaMode;
  href: string;
  label: string;
};

export const WelcomeStickyCta = ({ mode, href, label }: WelcomeStickyCtaProps) => {
  const hidden = mode === "hero";

  return (
    <div
      className="welcome-sticky-cta"
      data-mode={mode}
      data-testid="welcome-sticky-cta"
      aria-hidden={hidden ? true : undefined}
      inert={hidden ? true : undefined}
    >
      <Link className="ui-button ui-button-primary welcome-sticky-cta-button" to={href}>
        {label}
      </Link>
    </div>
  );
};
