import type { SessionDetail, SessionMessage, SessionUiState } from "./storage";

export const STYLE_OPTIONS = [
  {
    id: "cinematic",
    title: "电影感",
    description: "高对比光影与大片构图。",
  },
  {
    id: "anime",
    title: "动漫",
    description: "线条化渲染与高饱和色彩。",
  },
  {
    id: "low_poly",
    title: "低多边形",
    description: "块面几何与简化质感。",
  },
  {
    id: "realistic",
    title: "写实",
    description: "真实光照与细节层次。",
  },
];

export const MOOD_OPTIONS = [
  { id: "epic", label: "史诗" },
  { id: "calm", label: "平静" },
  { id: "horror", label: "恐怖" },
];

export const MODEL_OPTIONS = [
  { value: "atlas_3_preview", label: "Atlas-3 预览" },
  { value: "atlas_3_pro", label: "Atlas-3 高级" },
];

export const RESOLUTION_PRESETS = [
  { id: "panorama_2k", label: "全景 2K (2048×1024)", value: [2048, 1024] as [number, number] },
  { id: "1080p", label: "1080p (1920×1080)", value: [1920, 1080] as [number, number] },
  { id: "720p", label: "720p (1280×720)", value: [1280, 720] as [number, number] },
];

export const EXPORT_PRESETS = [
  { value: "mp4_720p", label: "720p（1280×720）" },
  { value: "mp4_1080p", label: "1080p（1920×1080）" },
  { value: "mp4_4k", label: "4K（3840×2160）" },
];

export const DEFAULT_DURATION = 14;
export const DEFAULT_ADVANCED_SETTINGS = {
  model: MODEL_OPTIONS[0].value,
  seed: "",
  resolution: RESOLUTION_PRESETS[0].id,
};
export const DEFAULT_EXPORT_PRESET = EXPORT_PRESETS[1]?.value ?? EXPORT_PRESETS[0].value;
export const DEFAULT_INSPECTOR_STAGE: SessionUiState["inspectorStage"] = "choosing_options";
export const DEFAULT_ACTIVE_TAB: SessionUiState["activeTab"] = "preview";

export const INITIAL_MESSAGES: SessionMessage[] = [
  {
    id: "system-1",
    role: "system",
    content:
      "我是你的创作助理，会把你的描述拆解成镜头、情绪与节奏。右侧面板已准备好记录风格与参数。发送一句话描述，开始构建场景。",
  },
];

export const createSessionId = () =>
  `sess_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const buildDefaultSessionDetail = (sessionId: string, createdAt: string): SessionDetail => ({
  id: sessionId,
  createdAt,
  updatedAt: createdAt,
  status: "draft",
  recovery: undefined,
  messages: INITIAL_MESSAGES,
  draft: "",
  options: {
    style: STYLE_OPTIONS[0].id,
    mood: MOOD_OPTIONS[0].id,
    duration: DEFAULT_DURATION,
    advancedSettings: DEFAULT_ADVANCED_SETTINGS,
    exportPreset: DEFAULT_EXPORT_PRESET,
  },
  ui: {
    inspectorStage: DEFAULT_INSPECTOR_STAGE,
    activeTab: DEFAULT_ACTIVE_TAB,
  },
});
