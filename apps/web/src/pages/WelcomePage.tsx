import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { SignalStageFrame } from "../components/welcome/SignalStageFrame";
import { HeroIntro } from "../components/welcome/HeroIntro";
import { HeroParticleField } from "../components/welcome/HeroParticleField";
import { WelcomeEndcapScene } from "../components/welcome/WelcomeEndcapScene";
import { WelcomeStageSceneShell } from "../components/welcome/WelcomeStageSceneShell";
import { WelcomeStickyCta } from "../components/welcome/WelcomeStickyCta";
import { WelcomeStorySection } from "../components/welcome/WelcomeStorySection";
import {
  type WelcomeStageSceneContent,
  WELCOME_STAGE_SCENES,
} from "../components/welcome/welcomeContent";
import type { WelcomeStageSceneId } from "../components/welcome/welcomeStageTimeline";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useWelcomeStageTimeline } from "../hooks/useWelcomeStageTimeline";
import { getRecoverableSessionHref } from "../lib/sessionRouting";
import { getActiveSessionId, getSessionDetail } from "../lib/storage";

import "./welcome.css";

function getRunningSessionHref(): string | undefined {
  const activeSessionId = getActiveSessionId();
  const detail = activeSessionId ? getSessionDetail(activeSessionId) : null;
  return getRecoverableSessionHref(detail);
}

function readIsMobile(): boolean {
  return typeof window !== "undefined" ? window.innerWidth <= 960 : false;
}

function resolveWelcomeScene(
  sceneId: WelcomeStageSceneId
): WelcomeStageSceneContent {
  const scene = WELCOME_STAGE_SCENES.find((entry) => entry.id === sceneId);

  if (!scene) {
    throw new Error(`Missing welcome scene for id "${sceneId}".`);
  }

  return scene;
}

function resolveWelcomeStoryScenes(): WelcomeStageSceneContent[] {
  const scenes = WELCOME_STAGE_SCENES.filter((scene) => scene.kind === "story");

  if (scenes.length === 0) {
    throw new Error("Expected welcome story scenes to be defined.");
  }

  return scenes;
}

export const WELCOME_HERO_SCENE = resolveWelcomeScene("hero");
export const WELCOME_STORY_SCENES = resolveWelcomeStoryScenes();
export const WELCOME_ENDCAP_SCENE = resolveWelcomeScene("endcap");

function isHeroParticleFieldActive({
  activeSceneId,
  phase,
  progress,
}: {
  activeSceneId: "hero" | "story-1" | "story-2" | "story-3" | "endcap";
  phase: "pre-enter" | "enter" | "dwell" | "exit";
  progress: number;
}): boolean {
  return (
    activeSceneId === "hero" ||
    phase === "enter" ||
    phase === "dwell" ||
    (phase === "exit" && progress < 0.999)
  );
}

export const WelcomePage = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [mobile, setMobile] = useState(readIsMobile);
  const runningHref = getRunningSessionHref();
  const primaryHref = runningHref ?? "/studio";
  const primaryLabel = runningHref ? "继续创作" : "进入创作台";

  useEffect(() => {
    const handleResize = () => {
      setMobile(readIsMobile());
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const { railRef, railMinHeight, progress, snapshot } = useWelcomeStageTimeline({
    mobile,
    reducedMotion: prefersReducedMotion,
  });
  const shellStyle = {
    "--stage-tone": String(snapshot.stageTone),
    "--corridor-progress": String(snapshot.corridorProgress),
    "--cta-dock-progress": String(snapshot.ctaDockProgress),
  } as CSSProperties;
  const sceneStateMap = snapshot.sceneStates;
  const heroParticleFieldActive = isHeroParticleFieldActive({
    activeSceneId: snapshot.activeSceneId,
    phase: sceneStateMap.hero.phase,
    progress: sceneStateMap.hero.progress,
  });
  const getSceneContentLayer = (sceneId: typeof snapshot.activeSceneId) =>
    snapshot.sceneStates[sceneId].phase === "dwell" && snapshot.sceneStates[sceneId].primary
      ? "3"
      : "2";
  const keepHeroSettled =
    sceneStateMap.hero.phase === "pre-enter" || sceneStateMap.hero.phase === "enter";
  const heroVisibilityProgress = keepHeroSettled ? 1 : sceneStateMap.hero.progress;
  const heroSceneStyle = {
    transform: keepHeroSettled ? "translate3d(0, 0, 0) scale(1)" : undefined,
  } as CSSProperties;

  return (
    <div className="welcome-page-shell" style={shellStyle}>
      <WelcomeStickyCta mode={snapshot.ctaMode} href={primaryHref} label={primaryLabel} />
      <main className="page welcome-page" data-reduced-motion={prefersReducedMotion ? "true" : "false"}>
        <section
          ref={railRef}
          className="welcome-stage-rail"
          style={{ minHeight: railMinHeight }}
        >
          <div
            className="welcome-stage-sticky"
            data-active-scene={snapshot.activeSceneId}
            data-progress={progress.toFixed(3)}
          >
            <SignalStageFrame
              activeSceneId={snapshot.activeSceneId}
              corridorProgress={snapshot.corridorProgress}
              ctaDockProgress={snapshot.ctaDockProgress}
              mode={snapshot.signalStageMode}
              stageTone={snapshot.stageTone}
            />
            <WelcomeStageSceneShell
              className="welcome-stage-scene-hero"
              contentLayer={getSceneContentLayer(WELCOME_HERO_SCENE.id)}
              sceneId={WELCOME_HERO_SCENE.id}
              sceneState={sceneStateMap.hero}
              style={heroSceneStyle}
              visibilityProgress={heroVisibilityProgress}
            >
              <HeroParticleField
                active={heroParticleFieldActive}
                corridorProgress={snapshot.corridorProgress}
                reducedMotion={prefersReducedMotion}
                scrollProgress={progress}
                sceneStrength={sceneStateMap.hero.intensity}
              />
              <HeroIntro
                mobile={mobile}
                prefersReducedMotion={prefersReducedMotion}
                primaryHref={primaryHref}
                primaryLabel={primaryLabel}
                runningHref={runningHref}
                scene={WELCOME_HERO_SCENE}
              />
            </WelcomeStageSceneShell>

            {WELCOME_STORY_SCENES.map((scene) => (
              <WelcomeStageSceneShell
                className="welcome-stage-scene-story"
                key={scene.id}
                contentLayer={getSceneContentLayer(scene.id)}
                layout={scene.stageLayout}
                sceneId={scene.id}
                sceneState={sceneStateMap[scene.id]}
              >
                <WelcomeStorySection scene={scene} />
              </WelcomeStageSceneShell>
            ))}

            <WelcomeStageSceneShell
              className="welcome-stage-scene-endcap"
              contentLayer={getSceneContentLayer(WELCOME_ENDCAP_SCENE.id)}
              layout="resolved"
              sceneId={WELCOME_ENDCAP_SCENE.id}
              sceneState={sceneStateMap[WELCOME_ENDCAP_SCENE.id]}
            >
              <WelcomeEndcapScene
                primaryHref={primaryHref}
                primaryLabel={primaryLabel}
                scene={WELCOME_ENDCAP_SCENE}
              />
            </WelcomeStageSceneShell>
          </div>
        </section>
      </main>
    </div>
  );
};
