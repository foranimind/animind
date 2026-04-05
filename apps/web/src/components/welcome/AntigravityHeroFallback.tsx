import { type CSSProperties, useId } from "react";

type AntigravityHeroFallbackProps = {
  active: boolean;
  corridorProgress: number;
  reducedMotion: boolean;
  scrollProgress: number;
  sceneStrength: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const AntigravityHeroFallback = ({
  active,
  corridorProgress,
  reducedMotion,
  scrollProgress,
  sceneStrength,
}: AntigravityHeroFallbackProps) => {
  const gradientId = useId();
  const massGradientId = `${gradientId}-mass`;
  const arcGradientId = `${gradientId}-arc`;
  const motionScale = reducedMotion ? 0.82 : 1;
  const shellOpacity = clamp((0.62 + sceneStrength * 0.28) * motionScale, 0.35, 1);
  const cloudShiftX = (scrollProgress - 0.5) * 18;
  const cloudShiftY = (corridorProgress - 0.5) * 10;
  const cloudScale = 0.96 + sceneStrength * 0.04;
  const arcOpacity = clamp((0.58 + sceneStrength * 0.24) * motionScale, 0.28, 0.92);
  const washOpacity = reducedMotion ? 0.42 : 0.55;

  const shellStyle = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    opacity: shellOpacity,
    background:
      "radial-gradient(circle at 50% 48%, rgba(139, 176, 255, 0.12), transparent 34%), radial-gradient(circle at 50% 70%, rgba(255, 177, 120, 0.08), transparent 44%)",
  } satisfies CSSProperties;

  const washStyle = {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(10, 14, 30, 0.04), rgba(10, 14, 30, 0.12)), radial-gradient(circle at 50% 52%, rgba(151, 173, 255, 0.14), transparent 52%)",
    opacity: washOpacity,
  } satisfies CSSProperties;

  const svgStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  } satisfies CSSProperties;

  return (
    <div
      className="antigravity-hero-fallback"
      data-testid="antigravity-hero-fallback"
      data-active={String(active)}
      data-reduced-motion={String(reducedMotion)}
      data-macro-silhouette="unified-cloud-broken-arc"
      data-layout-contract="hero-low-fidelity-unified-field"
      style={shellStyle}
      aria-hidden="true"
    >
      <div data-testid="antigravity-hero-fallback__wash" style={washStyle} />
      <svg
        data-testid="antigravity-hero-fallback__scene"
        style={svgStyle}
        viewBox="0 0 960 640"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id={massGradientId} cx="50%" cy="50%" r="72%">
            <stop offset="0%" stopColor="rgba(245, 248, 255, 0.92)" />
            <stop offset="56%" stopColor="rgba(154, 184, 255, 0.56)" />
            <stop offset="100%" stopColor="rgba(76, 115, 204, 0.06)" />
          </radialGradient>
          <linearGradient id={arcGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.82)" />
            <stop offset="58%" stopColor="rgba(157, 203, 255, 0.68)" />
            <stop offset="100%" stopColor="rgba(255, 154, 96, 0.24)" />
          </linearGradient>
        </defs>
        <g transform={`translate(${cloudShiftX}, ${cloudShiftY}) scale(${cloudScale})`}>
          <path
            data-testid="antigravity-hero-fallback__mass"
            d="M140 320c0-112 152-202 340-202s340 90 340 202-152 202-340 202S140 432 140 320Zm116 0c0 74 100 134 224 134s224-60 224-134-100-134-224-134-224 60-224 134Z"
            fill={`url(#${massGradientId})`}
            fillRule="evenodd"
          />
          <path
            data-testid="antigravity-hero-fallback__arc"
            d="M208 320c22-106 132-180 272-180 102 0 190 38 246 102M250 414c52 62 136 100 230 100 112 0 207-54 259-140"
            fill="none"
            stroke={`url(#${arcGradientId})`}
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={arcOpacity}
          />
          <path
            d="M308 214c48-28 112-42 178-42 54 0 104 10 148 30M278 446c58 40 130 62 206 62 72 0 140-20 196-56"
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="12"
            strokeLinecap="round"
            opacity={clamp((0.24 + sceneStrength * 0.14) * motionScale, 0.12, 0.45)}
          />
        </g>
      </svg>
    </div>
  );
};
