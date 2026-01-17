import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreateChatPanel } from "../components/chat/CreateChatPanel";
import { InspectorOptionsPanel } from "../components/inspector/InspectorOptionsPanel";
import { InspectorProgressPanel } from "../components/inspector/InspectorProgressPanel";
import { InspectorResultsPanel } from "../components/inspector/InspectorResultsPanel";
import type { SelectOption } from "../components/ui/SelectMenu";
import { useJobRunner } from "../hooks/useJobRunner";
import { useResource } from "../hooks/useAsync";
import { fetchManifest, fetchPreviewConfig, getAssetUrl } from "../lib/api";
import { toErrorMessage } from "../lib/errors";
import { getManifestAssetUris } from "../lib/manifestAssets";
import { createNewSession } from "../lib/sessionActions";
import {
  DEFAULT_ACTIVE_TAB,
  DEFAULT_ADVANCED_SETTINGS,
  DEFAULT_DURATION,
  DEFAULT_EXPORT_PRESET,
  DEFAULT_INSPECTOR_STAGE,
  EXPORT_PRESETS,
  INITIAL_MESSAGES,
  MODEL_OPTIONS,
  MOOD_OPTIONS,
  RESOLUTION_PRESETS,
  STYLE_OPTIONS,
  createSessionId,
} from "../lib/sessionDefaults";
import {
  getActiveSessionId,
  getSessionDetail,
  onSessionsUpdate,
  saveRecentWork,
  saveSessionDetail,
  touchSession,
  updateSessionIndex,
  type SessionDetail,
  type SessionStatus,
} from "../lib/storage";
import type {
  AssetItem,
  ChatMessage,
  InspectorStage,
  InspectorTab,
  TemplateSnippet,
} from "./create/types";
import "./pages.css";

const INSPECTOR_STAGE_LABELS: Record<InspectorStage, string> = {
  choosing_options: "参数",
  running: "生成中",
  complete: "交付",
};

const RESOLUTION_SELECT_OPTIONS: SelectOption[] = RESOLUTION_PRESETS.map((preset) => ({
  value: preset.id,
  label: preset.label,
}));

const EXPORT_SELECT_OPTIONS: SelectOption[] = EXPORT_PRESETS.map((preset) => ({
  value: preset.value,
  label: preset.label,
}));

const STAGE_LABELS: Record<string, string> = {
  QUEUED: "排队中",
  PLANNING: "规划",
  RUNNING_MOTION: "动作",
  RUNNING_SCENE: "场景",
  RUNNING_MUSIC: "音乐",
  COMPOSING_PREVIEW: "预览合成",
  EXPORTING_VIDEO: "导出",
  DONE: "完成",
  FAILED: "失败",
  CANCELED: "已取消",
  ERROR: "错误",
};

const resolveStageLabel = (stage?: string, status?: string) => {
  const key = (stage ?? status ?? "").toUpperCase();
  return STAGE_LABELS[key] ?? stage ?? status ?? "准备中";
};

const INSPECTOR_STEPS = [
  { id: "options", label: "参数" },
  { id: "running", label: "生成" },
  { id: "review", label: "交付" },
];

const INSPECTOR_TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: "preview", label: "预览" },
  { id: "assets", label: "素材" },
  { id: "export", label: "导出" },
];

const TEMPLATE_SNIPPETS: TemplateSnippet[] = [
  { id: "action", label: "动作", template: "动作：" },
  { id: "shot", label: "镜头", template: "镜头：" },
  { id: "mood", label: "氛围", template: "氛围：" },
  { id: "duration", label: "时长", template: "时长：" },
];

const createMessageId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const mapJobStatusToSessionStatus = (
  status?: string,
  error?: string | null
): SessionStatus => {
  if (error) {
    return "error";
  }
  const normalized = status?.toUpperCase() ?? "";
  if (!normalized) {
    return "draft";
  }
  if (normalized === "QUEUED") {
    return "queued";
  }
  if (normalized === "DONE" || normalized === "COMPLETED") {
    return "done";
  }
  if (normalized === "FAILED" || normalized === "ERROR") {
    return "error";
  }
  return "running";
};


export const CreatePage = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [inspectorStage, setInspectorStage] = useState<InspectorStage>(DEFAULT_INSPECTOR_STAGE);
  const [selectedStyle, setSelectedStyle] = useState(STYLE_OPTIONS[0].id);
  const [selectedMood, setSelectedMood] = useState(MOOD_OPTIONS[0].id);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState(DEFAULT_ADVANCED_SETTINGS);
  const [exportPreset, setExportPreset] = useState(DEFAULT_EXPORT_PRESET);
  const [activeTab, setActiveTab] = useState<InspectorTab>(DEFAULT_ACTIVE_TAB);
  const [toolMessageId, setToolMessageId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCreatedAt, setSessionCreatedAt] = useState<string>("");
  const chatThreadRef = useRef<HTMLUListElement | null>(null);
  const chatThreadWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatInputBoxRef = useRef<HTMLDivElement | null>(null);
  const advancedToggleRef = useRef<HTMLButtonElement | null>(null);
  const advancedPanelRef = useRef<HTMLDivElement | null>(null);
  const recentSaveRef = useRef<string>("");
  const sessionInitRef = useRef(false);
  const lastSessionStatusRef = useRef<string | null>(null);
  const sessionJobIdRef = useRef<string | null>(null);
  const lastJobIdRef = useRef<string | null>(null);
  const sessionSwitchRef = useRef(false);

  const latestPrompt = useMemo(() => {
    const match = [...messages].reverse().find((message) => message.role === "user");
    return match?.content ?? "";
  }, [messages]);
  const hasPrompt = latestPrompt.trim().length > 0;
  const canSend = draft.trim().length > 0;
  const resolutionPreset = useMemo(
    () => RESOLUTION_PRESETS.find((preset) => preset.id === advancedSettings.resolution),
    [advancedSettings.resolution]
  );
  const seedValue = useMemo(() => {
    const trimmed = advancedSettings.seed.trim();
    if (!trimmed) {
      return undefined;
    }
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }
    return Math.max(0, Math.floor(numeric));
  }, [advancedSettings.seed]);
  const jobOptions = useMemo(
    () => {
      const advanced: {
        model?: string;
        seed?: number;
        resolution?: [number, number];
      } = {
        model: advancedSettings.model,
      };
      if (seedValue !== undefined) {
        advanced.seed = seedValue;
      }
      if (resolutionPreset) {
        advanced.resolution = resolutionPreset.value;
      }
      return {
        style: selectedStyle,
        mood: selectedMood,
        duration_s: duration,
        export_video: true,
        export_preset: exportPreset,
        advanced,
      };
    },
    [advancedSettings.model, duration, exportPreset, resolutionPreset, seedValue, selectedMood, selectedStyle]
  );
  const {
    jobId,
    jobStatus,
    error: jobError,
    isStarting,
    start: startJob,
    subscribeExistingJob,
    reset: resetJobRunner,
  } = useJobRunner(latestPrompt, jobOptions);

  const insertTemplate = useCallback(
    (template: string) => {
      const textarea = inputRef.current;
      if (!textarea) {
        setDraft((prev) => (prev ? `${prev}\n${template}` : template));
        return;
      }
      const start = textarea.selectionStart ?? draft.length;
      const end = textarea.selectionEnd ?? draft.length;
      const before = draft.slice(0, start);
      const after = draft.slice(end);
      const needsBreak = before.length > 0 && !before.endsWith("\n");
      const insertion = `${needsBreak ? "\n" : ""}${template}`;
      const next = `${before}${insertion}${after}`;
      setDraft(next);
      requestAnimationFrame(() => {
        textarea.focus();
        const cursor = start + insertion.length;
        textarea.setSelectionRange(cursor, cursor);
      });
    },
    [draft]
  );

  const adjustSeed = useCallback((delta: number) => {
    setAdvancedSettings((prev) => {
      const current = Number(prev.seed);
      const base = Number.isFinite(current) ? current : 0;
      const next = Math.max(0, base + delta);
      return { ...prev, seed: String(next) };
    });
  }, []);

  const buildSessionDetail = useCallback(
    (overrides: Partial<SessionDetail> = {}): SessionDetail => {
      const now = new Date().toISOString();
      const resolvedId = overrides.id ?? sessionId ?? createSessionId();
      const createdAt = overrides.createdAt ?? (sessionCreatedAt || now);
      const resolvedLastPrompt =
        overrides.lastPrompt ?? (latestPrompt.trim() ? latestPrompt.trim() : undefined);
      return {
        id: resolvedId,
        createdAt,
        updatedAt: overrides.updatedAt ?? now,
        status: overrides.status ?? mapJobStatusToSessionStatus(jobStatus?.status, jobError),
        jobId: overrides.jobId ?? jobId ?? undefined,
        lastPrompt: resolvedLastPrompt,
        messages: overrides.messages ?? messages,
        draft: overrides.draft ?? draft,
        options: overrides.options ?? {
          style: selectedStyle,
          mood: selectedMood,
          duration,
          advancedSettings,
          exportPreset,
        },
        ui: overrides.ui ?? {
          inspectorStage,
          activeTab,
        },
      };
    },
    [
      activeTab,
      advancedSettings,
      draft,
      duration,
      exportPreset,
      inspectorStage,
      jobError,
      jobId,
      jobStatus?.status,
      latestPrompt,
      messages,
      selectedMood,
      selectedStyle,
      sessionCreatedAt,
      sessionId,
    ]
  );

  const resetJobSubscription = useCallback(() => {
    resetJobRunner();
    sessionJobIdRef.current = null;
    lastSessionStatusRef.current = null;
    lastJobIdRef.current = null;
  }, [resetJobRunner]);

  const applySessionDetail = useCallback((detail: SessionDetail) => {
    setSessionId(detail.id);
    setSessionCreatedAt(detail.createdAt);
    setMessages(detail.messages.length > 0 ? detail.messages : INITIAL_MESSAGES);
    setDraft(detail.draft);
    setInspectorStage(detail.ui.inspectorStage);
    setActiveTab(detail.ui.activeTab);
    setSelectedStyle(detail.options.style);
    setSelectedMood(detail.options.mood);
    setDuration(detail.options.duration);
    setAdvancedSettings(detail.options.advancedSettings);
    setExportPreset(detail.options.exportPreset);
    setPendingPrompt(null);
    setToolMessageId(null);
  }, []);

  const loadSessionById = useCallback(
    (targetId: string | null) => {
      sessionSwitchRef.current = true;
      try {
        if (sessionId && targetId !== sessionId) {
          const existing = getSessionDetail(sessionId);
          if (existing) {
            saveSessionDetail(
              buildSessionDetail({ updatedAt: existing.updatedAt }),
              { updatedAt: existing.updatedAt }
            );
          }
        }
        resetJobSubscription();
        if (!targetId) {
          return;
        }
        const detail = getSessionDetail(targetId);
        if (detail) {
          touchSession(targetId);
          applySessionDetail(detail);
          if (detail.jobId && detail.status !== "done" && detail.status !== "error") {
            subscribeExistingJob(detail.jobId);
          }
          return;
        }
        const fallback = createNewSession();
        applySessionDetail(fallback);
      } finally {
        sessionSwitchRef.current = false;
      }
    },
    [
      applySessionDetail,
      buildSessionDetail,
      resetJobSubscription,
      sessionId,
      subscribeExistingJob,
    ]
  );

  useEffect(() => {
    if (sessionInitRef.current) {
      return;
    }
    sessionInitRef.current = true;
    loadSessionById(getActiveSessionId());
  }, [loadSessionById]);

  useEffect(() => {
    if (!advancedOpen) {
      return;
    }
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        (advancedPanelRef.current && advancedPanelRef.current.contains(target)) ||
        (advancedToggleRef.current && advancedToggleRef.current.contains(target))
      ) {
        return;
      }
      setAdvancedOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
    };
  }, [advancedOpen]);

  useEffect(() => {
    const textarea = inputRef.current;
    const container = chatInputBoxRef.current;
    if (!textarea || !container) {
      return;
    }
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const { scrollTop, scrollHeight, clientHeight } = textarea;
      const hasOverflow = scrollHeight > clientHeight + 1;
      const trackHeight = clientHeight;
      const thumbHeight = hasOverflow
        ? Math.max(24, (clientHeight / scrollHeight) * trackHeight)
        : 0;
      const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
      const maxScrollTop = Math.max(1, scrollHeight - clientHeight);
      const thumbTop = hasOverflow ? (scrollTop / maxScrollTop) * maxThumbTop : 0;
      container.style.setProperty("--input-scroll-visible", hasOverflow ? "1" : "0");
      container.style.setProperty("--input-scroll-thumb-height", `${thumbHeight}px`);
      container.style.setProperty("--input-scroll-thumb-top", `${thumbTop}px`);
    };
    const schedule = () => {
      if (frame !== null) {
        return;
      }
      frame = requestAnimationFrame(update);
    };
    update();
    textarea.addEventListener("scroll", schedule);
    textarea.addEventListener("input", schedule);
    window.addEventListener("resize", schedule);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resizeObserver?.observe(textarea);
    return () => {
      textarea.removeEventListener("scroll", schedule);
      textarea.removeEventListener("input", schedule);
      window.removeEventListener("resize", schedule);
      resizeObserver?.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [draft]);

  useEffect(() => {
    const handler = () => {
      if (sessionSwitchRef.current) {
        return;
      }
      const activeId = getActiveSessionId();
      if (activeId === sessionId) {
        return;
      }
      loadSessionById(activeId);
    };
    return onSessionsUpdate(handler);
  }, [loadSessionById, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const timer = globalThis.setTimeout(() => {
      const existing = getSessionDetail(sessionId);
      if (!existing) {
        return;
      }
      saveSessionDetail(
        buildSessionDetail({ updatedAt: existing.updatedAt }),
        { updatedAt: existing.updatedAt }
      );
    }, 400);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [buildSessionDetail, sessionId]);

  const activeStepIndex =
    inspectorStage === "complete" ? 2 : inspectorStage === "running" ? 1 : 0;

  const progressValue =
    typeof jobStatus?.progress === "number"
      ? Math.max(0, Math.min(100, Math.round(jobStatus.progress)))
      : 0;
  const progressLabel = typeof jobStatus?.progress === "number" ? `${progressValue}%` : "--";
  const progressStage = resolveStageLabel(jobStatus?.stage, jobStatus?.status);
  const logLines =
    jobStatus?.logs_tail && jobStatus.logs_tail.length > 0
      ? jobStatus.logs_tail.slice(-3)
      : jobStatus?.message
        ? [jobStatus.message]
        : ["等待日志输出..."];
  const queuePosition = jobStatus?.queue_position;
  const normalizedJobStatus = jobStatus?.status?.toUpperCase() ?? "";
  const queueLabel =
    queuePosition !== undefined
      ? `#${queuePosition}`
      : normalizedJobStatus === "QUEUED"
        ? "排队中"
        : "--";
  const isJobDone = normalizedJobStatus === "DONE" || normalizedJobStatus === "COMPLETED";
  const isJobActive =
    !!jobStatus && !["DONE", "COMPLETED", "FAILED", "ERROR"].includes(normalizedJobStatus);

  const assetJobId = isJobDone ? jobId ?? null : null;
  const mapAssetError = useCallback(
    (error: unknown) => toErrorMessage(error, "资源加载失败"),
    []
  );
  const loadManifest = useCallback(
    () => fetchManifest(assetJobId ?? ""),
    [assetJobId]
  );
  const loadPreviewConfig = useCallback(
    () => fetchPreviewConfig(assetJobId ?? ""),
    [assetJobId]
  );
  const manifestState = useResource(loadManifest, {
    enabled: Boolean(assetJobId),
    mapError: mapAssetError,
  });
  const previewConfigState = useResource(loadPreviewConfig, {
    enabled: Boolean(assetJobId),
    mapError: mapAssetError,
  });
  const manifest =
    manifestState.status === "ready" ? (manifestState.data ?? null) : null;
  const previewConfig =
    previewConfigState.status === "ready" ? (previewConfigState.data ?? null) : null;
  const previewConfigMissing =
    previewConfigState.status === "error" && previewConfigState.notFound === true;
  const assetError =
    previewConfigState.status === "error" && !previewConfigState.notFound
      ? previewConfigState.error ?? "资源加载失败"
      : manifestState.status === "error" && !manifestState.notFound
        ? manifestState.error ?? "资源加载失败"
        : null;
  const isLoadingAssets =
    manifestState.status === "loading" || previewConfigState.status === "loading";

  const assetItems = useMemo(() => {
    const items: AssetItem[] = [];
    const seen = new Set<string>();
    const addItem = (label: string, uri: string | undefined, kind: string) => {
      if (!uri) {
        return;
      }
      const href = getAssetUrl(uri);
      if (seen.has(href)) {
        return;
      }
      seen.add(href);
      items.push({ id: `${kind}-${items.length}`, label, href, kind });
    };

    const manifestAssets = getManifestAssetUris(manifest);
    addItem("场景全景 PNG", manifestAssets.scenePanorama, "png");
    addItem("动作 BVH", manifestAssets.motionBvh, "bvh");
    addItem("配乐 WAV", manifestAssets.musicWav, "wav");
    addItem("导出 MP4", manifestAssets.exportMp4, "mp4");
    addItem("导出 ZIP", manifestAssets.exportZip, "zip");

    if (jobStatus) {
      addItem("预览 MP4", jobStatus.preview_url, "mp4");
      if (Array.isArray(jobStatus.mp4_list)) {
        jobStatus.mp4_list.forEach((uri) => addItem("预览 MP4", uri, "mp4"));
      }
      addItem("动作 BVH", jobStatus.bvh_download_url ?? jobStatus.download_url, "bvh");
      addItem("配乐 WAV", jobStatus.audio_url, "wav");
      addItem("导出 ZIP", jobStatus.zip_url, "zip");
    }

    return items;
  }, [jobStatus, manifest]);

  const previewLinks = useMemo(
    () => assetItems.filter((item) => ["mp4", "wav", "bvh"].includes(item.kind)),
    [assetItems]
  );
  const assetDownloads = useMemo(
    () => assetItems.filter((item) => ["png", "bvh", "wav"].includes(item.kind)),
    [assetItems]
  );
  const audioPreviewUrl = jobStatus?.audio_url ?? previewConfig?.music?.wav_uri;
  const audioPreviewSrc = audioPreviewUrl ? getAssetUrl(audioPreviewUrl) : "";
  const exportMp4 =
    assetItems.find((item) => item.label.includes("导出 MP4")) ??
    assetItems.find((item) => item.kind === "mp4");

  const toolMessageContent = useMemo(() => {
    if (!toolMessageId) {
      return "";
    }
    if (jobError) {
      return `生成失败：${jobError}`;
    }
    if (!jobId) {
      return "正在创建任务...";
    }
    if (!jobStatus) {
      return `任务已创建（${jobId}），等待事件流连接...`;
    }
    const normalizedStatus = jobStatus.status?.toUpperCase();
    if (normalizedStatus === "DONE" || normalizedStatus === "COMPLETED") {
      return "生成完成，正在准备预览。";
    }
    if (normalizedStatus === "ERROR" || normalizedStatus === "FAILED") {
      return `生成失败：${jobStatus.message ?? "未知错误"}`;
    }
    const toolLogLines =
      jobStatus.logs_tail && jobStatus.logs_tail.length > 0
        ? jobStatus.logs_tail.slice(-3)
        : jobStatus.message
          ? [jobStatus.message]
          : [];
    const logSummary = toolLogLines.length > 0 ? `\n${toolLogLines.join("\n")}` : "";
    return `生成中 ${progressLabel} · ${progressStage}${logSummary}`;
  }, [jobError, jobId, jobStatus, progressLabel, progressStage, toolMessageId]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    const now = new Date().toISOString();
    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: createMessageId(), role: "user", content: trimmed },
      { id: createMessageId(), role: "system", content: "正在规划..." },
    ];
    setMessages(nextMessages);
    if (sessionId) {
      saveSessionDetail(
        buildSessionDetail({
          messages: nextMessages,
          draft: "",
          lastPrompt: trimmed,
          updatedAt: now,
          status: "draft",
          ui: {
            inspectorStage: DEFAULT_INSPECTOR_STAGE,
            activeTab,
          },
        })
      );
    }
    setDraft("");
    setToolMessageId(null);
    setInspectorStage(DEFAULT_INSPECTOR_STAGE);
    setPendingPrompt(trimmed);
  };

  useEffect(() => {
    if (!jobId || jobId === lastJobIdRef.current) {
      return;
    }
    if (!sessionId) {
      return;
    }
    lastJobIdRef.current = jobId;
    const now = new Date().toISOString();
    const status = mapJobStatusToSessionStatus(jobStatus?.status, jobError);
    const existing = getSessionDetail(sessionId);
    const detail = existing
      ? { ...existing, jobId, status, updatedAt: now }
      : buildSessionDetail({ jobId, status, updatedAt: now });
    saveSessionDetail(detail);
    sessionJobIdRef.current = jobId;
  }, [buildSessionDetail, jobError, jobId, jobStatus?.status, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    if (!jobId || sessionJobIdRef.current !== jobId) {
      return;
    }
    const statusKey = jobError ? "ERROR" : jobStatus?.status;
    if (!statusKey) {
      return;
    }
    if (lastSessionStatusRef.current === statusKey) {
      return;
    }
    lastSessionStatusRef.current = statusKey;
    updateSessionIndex(sessionId, {
      status: mapJobStatusToSessionStatus(statusKey, jobError),
      updatedAt: new Date().toISOString(),
    });
  }, [jobError, jobId, jobStatus?.status, sessionId]);

  useEffect(() => {
    if (!toolMessageId || !toolMessageContent) {
      return;
    }
    setMessages((prev) =>
      prev.map((message) =>
        message.id === toolMessageId ? { ...message, content: toolMessageContent } : message
      )
    );
  }, [toolMessageContent, toolMessageId]);

  useEffect(() => {
    if (!jobStatus) {
      return;
    }
    const normalizedStatus = jobStatus.status?.toUpperCase();
    if (normalizedStatus === "DONE" || normalizedStatus === "COMPLETED") {
      setInspectorStage("complete");
      setActiveTab("preview");
    }
  }, [jobStatus]);

  const handleStartGeneration = useCallback(async () => {
    if (!hasPrompt || isStarting || isJobActive) {
      return;
    }
    const toolId = `tool-${createMessageId()}`;
    setMessages((prev) => [
      ...prev,
      { id: toolId, role: "tool", content: "正在创建任务..." },
    ]);
    setToolMessageId(toolId);
    setPendingPrompt(null);
    setInspectorStage("running");
    try {
      await startJob();
    } catch (error) {
      const message = error instanceof Error ? error.message : "任务创建失败";
      setMessages((prev) =>
        prev.map((item) =>
          item.id === toolId ? { ...item, content: `创建失败：${message}` } : item
        )
      );
      setInspectorStage(DEFAULT_INSPECTOR_STAGE);
    }
  }, [hasPrompt, isJobActive, isStarting, startJob]);

  useEffect(() => {
    if (!pendingPrompt) {
      return;
    }
    if (latestPrompt.trim() !== pendingPrompt.trim()) {
      return;
    }
    if (isStarting || isJobActive) {
      return;
    }
    handleStartGeneration();
    setPendingPrompt(null);
  }, [handleStartGeneration, isJobActive, isStarting, latestPrompt, pendingPrompt]);

  useEffect(() => {
    const thread = chatThreadRef.current;
    if (!thread) {
      return;
    }
    requestAnimationFrame(() => {
      thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
    });
  }, [messages]);

  useEffect(() => {
    const thread = chatThreadRef.current;
    const wrapper = chatThreadWrapRef.current;
    if (!thread || !wrapper) {
      return;
    }
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const { scrollTop, scrollHeight, clientHeight } = thread;
      const hasOverflow = scrollHeight > clientHeight + 1;
      const trackHeight = clientHeight;
      const thumbHeight = hasOverflow
        ? Math.max(32, (clientHeight / scrollHeight) * trackHeight)
        : 0;
      const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
      const maxScrollTop = Math.max(1, scrollHeight - clientHeight);
      const thumbTop = hasOverflow ? (scrollTop / maxScrollTop) * maxThumbTop : 0;
      wrapper.style.setProperty("--thread-scroll-visible", hasOverflow ? "1" : "0");
      wrapper.style.setProperty("--thread-scroll-thumb-height", `${thumbHeight}px`);
      wrapper.style.setProperty("--thread-scroll-thumb-top", `${thumbTop}px`);
    };
    const schedule = () => {
      if (frame !== null) {
        return;
      }
      frame = requestAnimationFrame(update);
    };
    update();
    thread.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resizeObserver?.observe(thread);
    return () => {
      thread.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resizeObserver?.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [messages]);

  useEffect(() => {
    if (!jobId || !isJobDone) {
      return;
    }
    if (!manifest && !previewConfig) {
      return;
    }
    const title = (manifest?.inputs?.raw_prompt ?? latestPrompt).trim();
    const previewUri =
      manifest?.outputs?.scene?.panorama?.uri ?? previewConfig?.scene?.panorama_uri;
    const createdAt = manifest?.created_at ?? new Date().toISOString();
    const signature = JSON.stringify({
      jobId,
      title,
      previewUri: previewUri ?? "",
      createdAt,
    });
    if (recentSaveRef.current === signature) {
      return;
    }
    recentSaveRef.current = signature;
    const meta: { title?: string; createdAt?: string; previewUrl?: string } = {};
    if (title) {
      meta.title = title;
    }
    if (createdAt) {
      meta.createdAt = createdAt;
    }
    if (previewUri) {
      meta.previewUrl = previewUri;
    }
    saveRecentWork(jobId, meta);
    if (sessionId && sessionJobIdRef.current === jobId) {
      updateSessionIndex(sessionId, {
        previewUrl: previewUri ?? undefined,
        status: "done",
        updatedAt: new Date().toISOString(),
      });
    }
  }, [isJobDone, jobId, latestPrompt, manifest, previewConfig, sessionId]);

  const handleComplete = () => {
    setInspectorStage("complete");
    setActiveTab("preview");
  };

  return (
    <div className="page create-page">
      <div className="create-shell">
      <CreateChatPanel
        messages={messages}
        templateSnippets={TEMPLATE_SNIPPETS}
        draft={draft}
        canSend={canSend}
        onDraftChange={(value) => setDraft(value)}
        onSend={handleSend}
        onInsertTemplate={insertTemplate}
        chatThreadRef={chatThreadRef}
        chatThreadWrapRef={chatThreadWrapRef}
        chatInputBoxRef={chatInputBoxRef}
        inputRef={inputRef}
      />

        <aside className="create-inspector">
          <div className="inspector-card">
            <div className="inspector-header">
              <div>
                <div className="inspector-title">参数面板</div>
                <div className="inspector-subtitle">
                  {inspectorStage === "choosing_options" && "选择风格与节奏，让系统开始生成。"}
                  {inspectorStage === "running" && "生成中，正在整理场景与素材。"}
                  {inspectorStage === "complete" && "查看预览与导出设置。"}
                </div>
              </div>
              <div className="inspector-stage-pill">{INSPECTOR_STAGE_LABELS[inspectorStage]}</div>
            </div>

            <div className="inspector-steps">
              {INSPECTOR_STEPS.map((step, index) => {
                const status =
                  index === activeStepIndex ? "active" : index < activeStepIndex ? "complete" : "";
                return (
                  <div key={step.id} className={`inspector-step ${status}`}>
                    <span className="step-index">{index + 1}</span>
                    <span className="step-label">{step.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="inspector-body">
              {inspectorStage === "choosing_options" && (
                <InspectorOptionsPanel
                  hasPrompt={hasPrompt}
                  isStarting={isStarting}
                  isJobActive={isJobActive}
                  styleOptions={STYLE_OPTIONS}
                  moodOptions={MOOD_OPTIONS}
                  selectedStyle={selectedStyle}
                  selectedMood={selectedMood}
                  duration={duration}
                  advancedOpen={advancedOpen}
                  advancedSettings={advancedSettings}
                  modelOptions={MODEL_OPTIONS}
                  resolutionOptions={RESOLUTION_SELECT_OPTIONS}
                  onSelectStyle={(value) => setSelectedStyle(value)}
                  onSelectMood={(value) => setSelectedMood(value)}
                  onDurationChange={(value) => setDuration(value)}
                  onToggleAdvanced={() => setAdvancedOpen((prev) => !prev)}
                  onAdvancedSettingsChange={setAdvancedSettings}
                  onAdjustSeed={adjustSeed}
                  advancedToggleRef={advancedToggleRef}
                  advancedPanelRef={advancedPanelRef}
                  onStartGeneration={handleStartGeneration}
                />
              )}

              {inspectorStage === "running" && (
                <InspectorProgressPanel
                  progressStage={progressStage}
                  progressLabel={progressLabel}
                  progressValue={progressValue}
                  queueLabel={queueLabel}
                  logLines={logLines}
                  onComplete={handleComplete}
                />
              )}

              {inspectorStage === "complete" && (
                <InspectorResultsPanel
                  tabs={INSPECTOR_TABS}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  previewConfig={previewConfig}
                  previewConfigMissing={previewConfigMissing}
                  assetError={assetError}
                  isLoadingAssets={isLoadingAssets}
                  previewLinks={previewLinks}
                  assetDownloads={assetDownloads}
                  audioPreviewSrc={audioPreviewSrc}
                  exportPreset={exportPreset}
                  exportOptions={EXPORT_SELECT_OPTIONS}
                  onExportPresetChange={setExportPreset}
                  exportMp4={exportMp4}
                  jobId={jobId ?? undefined}
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

