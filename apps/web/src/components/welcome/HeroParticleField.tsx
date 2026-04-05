import { Suspense, lazy, useEffect, useState } from "react";

import { supportsAntigravityHeroWebGL } from "./antigravityHeroSupport";
import { AntigravityHeroFallback } from "./AntigravityHeroFallback";
import { classNames } from "../../lib/classNames";

type HeroParticleFieldProps = {
  active: boolean;
  corridorProgress?: number;
  reducedMotion: boolean;
  scrollProgress: number;
  sceneStrength: number;
};

export type HeroParticleFieldRenderMode = "pending" | "stage" | "fallback";

const ANTIGRAVITY_HERO_STAGE_SEED = 41;
const LazyAntigravityHeroStage = lazy(async () => ({
  default: (await import("./AntigravityHeroStage")).AntigravityHeroStage,
}));

export function resolveHeroParticleFieldRenderMode(
  supportsWebGL: boolean | null
): HeroParticleFieldRenderMode {
  if (supportsWebGL === true) {
    return "stage";
  }

  if (supportsWebGL === false) {
    return "fallback";
  }

  return "pending";
}

export const HeroParticleField = ({
  active,
  corridorProgress = 0,
  reducedMotion,
  scrollProgress,
  sceneStrength,
}: HeroParticleFieldProps) => {
  const [supportsWebGL, setSupportsWebGL] = useState<boolean | null>(null);
  const shouldPrimeFirstScreen =
    !active && scrollProgress <= 0.01 && corridorProgress <= 0.01 && sceneStrength <= 0.06;
  const effectiveActive = active || shouldPrimeFirstScreen;
  const effectiveSceneStrength = shouldPrimeFirstScreen
    ? Math.max(sceneStrength, reducedMotion ? 0.54 : 0.74)
    : sceneStrength;
  const renderMode = resolveHeroParticleFieldRenderMode(supportsWebGL);

  useEffect(() => {
    setSupportsWebGL(supportsAntigravityHeroWebGL());
  }, []);

  return (
    <div
      className={classNames(
        "welcome-particle-field",
        renderMode === "fallback" && "is-fallback"
      )}
      style={{ opacity: Math.min(1, 0.74 + effectiveSceneStrength * 0.26) }}
      aria-hidden="true"
    >
      {renderMode === "stage" ? (
        <Suspense fallback={null}>
          <LazyAntigravityHeroStage
            active={effectiveActive}
            corridorProgress={corridorProgress}
            reducedMotion={reducedMotion}
            scrollProgress={scrollProgress}
            sceneStrength={effectiveSceneStrength}
            seed={ANTIGRAVITY_HERO_STAGE_SEED}
            webglSupported={supportsWebGL}
          />
        </Suspense>
      ) : null}
      {renderMode === "fallback" ? (
        <AntigravityHeroFallback
          active={effectiveActive}
          corridorProgress={corridorProgress}
          reducedMotion={reducedMotion}
          scrollProgress={scrollProgress}
          sceneStrength={effectiveSceneStrength}
        />
      ) : null}
      <div className="welcome-particle-field-wash" />
    </div>
  );
};
