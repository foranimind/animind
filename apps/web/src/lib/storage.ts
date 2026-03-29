const RECENT_WORKS_KEY = "foranimind.recentWorks";
const MAX_RECENT_WORKS = 10;
const RECENT_WORKS_EVENT = "foranimind:recentWorksUpdated";

export type RecentWorkMeta = Record<string, unknown> & {
  title?: string;
  createdAt?: string;
  previewUrl?: string;
};

export type RecentWork = {
  jobId: string;
  meta: RecentWorkMeta;
  updatedAt: string;
};

const notifyUpdate = () => {
  if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
    globalThis.dispatchEvent(new CustomEvent(RECENT_WORKS_EVENT));
  }
};

const safeParse = (value: string | null): RecentWork[] => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is RecentWork => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const record = item as Record<string, unknown>;
      return typeof record.jobId === "string" && typeof record.updatedAt === "string";
    });
  } catch {
    return [];
  }
};

const readRecentWorks = (): RecentWork[] => {
  if (typeof localStorage === "undefined") {
    return [];
  }
  return safeParse(localStorage.getItem(RECENT_WORKS_KEY));
};

const writeRecentWorks = (items: RecentWork[]) => {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(RECENT_WORKS_KEY, JSON.stringify(items));
  notifyUpdate();
};

export const saveRecentWork = (jobId: string, meta: RecentWorkMeta = {}) => {
  const items = readRecentWorks();
  const now = new Date().toISOString();
  const existing = items.find((item) => item.jobId === jobId);
  const mergedMeta = { ...(existing?.meta ?? {}), ...meta };
  const next: RecentWork = { jobId, meta: mergedMeta, updatedAt: now };
  const nextItems = [next, ...items.filter((item) => item.jobId !== jobId)];
  writeRecentWorks(nextItems.slice(0, MAX_RECENT_WORKS));
};

export const listRecentWorks = (): RecentWork[] => {
  const items = readRecentWorks();
  return items
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_RECENT_WORKS);
};

export const removeWork = (jobId: string) => {
  const items = readRecentWorks();
  writeRecentWorks(items.filter((item) => item.jobId !== jobId));
};

export const onRecentWorksUpdate = (handler: () => void) => {
  if (typeof globalThis.addEventListener !== "function") {
    return () => {};
  }
  const listener = () => handler();
  globalThis.addEventListener("storage", listener);
  globalThis.addEventListener(RECENT_WORKS_EVENT, listener as EventListener);
  return () => {
    globalThis.removeEventListener("storage", listener);
    globalThis.removeEventListener(RECENT_WORKS_EVENT, listener as EventListener);
  };
};

const SESSION_INDEX_KEY = "foranimind.sessions";
const SESSION_KEY_PREFIX = "foranimind.session.";
const ACTIVE_SESSION_KEY = "foranimind.activeSessionId";
const SESSIONS_EVENT = "foranimind:sessionsUpdated";
const MAX_TITLE_LENGTH = 48;
const DEFAULT_SESSION_TITLE = "新建项目";
const LEGACY_SESSION_TITLE = "New project";

export type SessionStatus = "draft" | "queued" | "running" | "done" | "error" | "canceled";
export type SessionMessageRole = "user" | "system" | "tool" | "result";
export type SessionTitleSource = "auto" | "custom";

export type SessionMessage = {
  id: string;
  role: SessionMessageRole;
  content: string;
};

export type SessionOptions = {
  style: string;
  mood: string;
  duration: number;
  advancedSettings: {
    model: string;
    seed: string;
    resolution: string;
  };
  exportPreset: string;
};

export type SessionUiState = {
  inspectorStage: "choosing_options" | "running" | "complete";
  activeTab: "preview" | "assets" | "export";
};

export type SessionRecovery = {
  reason: "error" | "canceled";
  message?: string;
  stage?: string;
  updatedAt: string;
};

export type SessionDetail = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  jobId?: string;
  lastPrompt?: string;
  recovery?: SessionRecovery;
  messages: SessionMessage[];
  draft: string;
  options: SessionOptions;
  ui: SessionUiState;
};

export type SessionIndexItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  jobId?: string;
  previewUrl?: string;
  titleSource?: SessionTitleSource;
  titleEditedAt?: string;
  lastOpenedAt?: string;
  pinned?: boolean;
};

const SESSION_STATUS_VALUES: SessionStatus[] = [
  "draft",
  "queued",
  "running",
  "done",
  "error",
  "canceled",
];

const isSessionStatus = (value: unknown): value is SessionStatus =>
  typeof value === "string" && SESSION_STATUS_VALUES.includes(value as SessionStatus);

const isSessionMessageRole = (value: unknown): value is SessionMessageRole =>
  value === "user" || value === "system" || value === "tool" || value === "result";

const isSessionMessage = (value: unknown): value is SessionMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.content === "string" &&
    isSessionMessageRole(record.role)
  );
};

const isSessionOptions = (value: unknown): value is SessionOptions => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const advanced = record.advancedSettings;
  if (!advanced || typeof advanced !== "object") {
    return false;
  }
  const advancedRecord = advanced as Record<string, unknown>;
  return (
    typeof record.style === "string" &&
    typeof record.mood === "string" &&
    typeof record.duration === "number" &&
    Number.isFinite(record.duration) &&
    typeof record.exportPreset === "string" &&
    typeof advancedRecord.model === "string" &&
    typeof advancedRecord.seed === "string" &&
    typeof advancedRecord.resolution === "string"
  );
};

const isSessionUiState = (value: unknown): value is SessionUiState => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const stage = record.inspectorStage;
  const tab = record.activeTab;
  return (
    (stage === "choosing_options" || stage === "running" || stage === "complete") &&
    (tab === "preview" || tab === "assets" || tab === "export")
  );
};

const isSessionRecovery = (value: unknown): value is SessionRecovery => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    (record.reason === "error" || record.reason === "canceled") &&
    typeof record.updatedAt === "string" &&
    (record.message === undefined || typeof record.message === "string") &&
    (record.stage === undefined || typeof record.stage === "string")
  );
};

const isSessionIndexItem = (value: unknown): value is SessionIndexItem => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const titleSource = record.titleSource;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    isSessionStatus(record.status) &&
    (record.jobId === undefined || typeof record.jobId === "string") &&
    (record.previewUrl === undefined || typeof record.previewUrl === "string") &&
    (titleSource === undefined || titleSource === "auto" || titleSource === "custom") &&
    (record.titleEditedAt === undefined || typeof record.titleEditedAt === "string") &&
    (record.lastOpenedAt === undefined || typeof record.lastOpenedAt === "string") &&
    (record.pinned === undefined || typeof record.pinned === "boolean")
  );
};

const safeParseSessionIndex = (value: string | null): SessionIndexItem[] => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isSessionIndexItem);
  } catch {
    return [];
  }
};

const safeParseSessionDetail = (value: string | null): SessionDetail | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.createdAt !== "string" ||
      typeof record.updatedAt !== "string" ||
      !isSessionStatus(record.status) ||
      typeof record.draft !== "string" ||
      !isSessionOptions(record.options) ||
      !isSessionUiState(record.ui) ||
      !Array.isArray(record.messages)
    ) {
      return null;
    }
    const messages = record.messages.filter(isSessionMessage);
    return {
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      status: record.status,
      jobId: typeof record.jobId === "string" ? record.jobId : undefined,
      lastPrompt: typeof record.lastPrompt === "string" ? record.lastPrompt : undefined,
      recovery: isSessionRecovery(record.recovery) ? record.recovery : undefined,
      messages,
      draft: record.draft,
      options: record.options,
      ui: record.ui,
    };
  } catch {
    return null;
  }
};

const notifySessionsUpdate = () => {
  if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
    globalThis.dispatchEvent(new CustomEvent(SESSIONS_EVENT));
  }
};

const readSessionIndex = (): SessionIndexItem[] => {
  if (typeof localStorage === "undefined") {
    return [];
  }
  return safeParseSessionIndex(localStorage.getItem(SESSION_INDEX_KEY));
};

const writeSessionIndex = (items: SessionIndexItem[]) => {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(items));
  notifySessionsUpdate();
};

const getSessionDetailKey = (sessionId: string) => `${SESSION_KEY_PREFIX}${sessionId}`;

const truncateTitle = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_TITLE_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, MAX_TITLE_LENGTH - 3))}...`;
};

const normalizeTitle = (value: string) => truncateTitle(value);

const isDefaultTitle = (value: string | undefined) => {
  if (!value) {
    return true;
  }
  const trimmed = value.trim();
  return trimmed === DEFAULT_SESSION_TITLE || trimmed === LEGACY_SESSION_TITLE;
};

const deriveSessionTitle = (detail: SessionDetail): string => {
  const explicit = detail.lastPrompt?.trim() ?? "";
  if (explicit) {
    return truncateTitle(explicit);
  }
  const firstUser = detail.messages.find((message) => message.role === "user");
  if (firstUser?.content) {
    return truncateTitle(firstUser.content.trim());
  }
  return DEFAULT_SESSION_TITLE;
};

export const listSessions = (): SessionIndexItem[] => {
  const items = readSessionIndex();
  return items.slice().sort((a, b) => {
    const pinnedDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinnedDelta !== 0) {
      return pinnedDelta;
    }
    const aLast = a.updatedAt ?? a.lastOpenedAt ?? a.createdAt;
    const bLast = b.updatedAt ?? b.lastOpenedAt ?? b.createdAt;
    const lastDelta = bLast.localeCompare(aLast);
    if (lastDelta !== 0) {
      return lastDelta;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
};

export const getActiveSessionId = (): string | null => {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(ACTIVE_SESSION_KEY);
};

export const setActiveSessionId = (sessionId: string | null) => {
  if (typeof localStorage === "undefined") {
    return;
  }
  if (sessionId) {
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
  notifySessionsUpdate();
};

export const getSessionDetail = (sessionId: string): SessionDetail | null => {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return safeParseSessionDetail(localStorage.getItem(getSessionDetailKey(sessionId)));
};

export const saveSessionDetail = (
  detail: SessionDetail,
  indexOverrides: Partial<SessionIndexItem> = {}
) => {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(getSessionDetailKey(detail.id), JSON.stringify(detail));
  const items = readSessionIndex();
  const existing = items.find((item) => item.id === detail.id);
  const overrideTitle = indexOverrides.title ? normalizeTitle(indexOverrides.title) : undefined;
  const resolvedTitleSource: SessionTitleSource =
    indexOverrides.titleSource ??
    (overrideTitle ? "custom" : existing?.titleSource ?? "auto");
  const derivedTitle = deriveSessionTitle(detail);
  const shouldAutoUpdateTitle =
    resolvedTitleSource !== "custom" &&
    !isDefaultTitle(derivedTitle) &&
    isDefaultTitle(existing?.title ?? DEFAULT_SESSION_TITLE);
  const nextTitle =
    overrideTitle ??
    (shouldAutoUpdateTitle ? derivedTitle : existing?.title ?? derivedTitle ?? DEFAULT_SESSION_TITLE);
  const nextItem: SessionIndexItem = {
    id: detail.id,
    title: nextTitle,
    createdAt: indexOverrides.createdAt ?? existing?.createdAt ?? detail.createdAt,
    updatedAt: indexOverrides.updatedAt ?? detail.updatedAt,
    status: indexOverrides.status ?? detail.status,
    jobId: indexOverrides.jobId ?? detail.jobId ?? existing?.jobId,
    previewUrl: indexOverrides.previewUrl ?? existing?.previewUrl,
    titleSource: resolvedTitleSource,
    titleEditedAt:
      resolvedTitleSource === "custom"
        ? indexOverrides.titleEditedAt ?? existing?.titleEditedAt
        : undefined,
    lastOpenedAt: indexOverrides.lastOpenedAt ?? existing?.lastOpenedAt,
    pinned: indexOverrides.pinned ?? existing?.pinned,
  };
  const nextItems = [nextItem, ...items.filter((item) => item.id !== detail.id)];
  writeSessionIndex(nextItems);
};

export const upsertSessionIndex = (item: SessionIndexItem) => {
  const items = readSessionIndex();
  const nextItems = [item, ...items.filter((entry) => entry.id !== item.id)];
  writeSessionIndex(nextItems);
};

export const updateSessionIndex = (sessionId: string, patch: Partial<SessionIndexItem>) => {
  const items = readSessionIndex();
  const existing = items.find((item) => item.id === sessionId);
  const now = new Date().toISOString();
  const base: SessionIndexItem = existing ?? {
    id: sessionId,
    title: DEFAULT_SESSION_TITLE,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    titleSource: "auto",
  };
  const overrideTitle = patch.title ? normalizeTitle(patch.title) : undefined;
  const resolvedTitleSource: SessionTitleSource =
    patch.titleSource ?? (overrideTitle ? "custom" : base.titleSource ?? "auto");
  const nextTitle = overrideTitle ?? base.title;
  const nextTitleEditedAt =
    resolvedTitleSource === "custom" ? patch.titleEditedAt ?? base.titleEditedAt : undefined;
  const next: SessionIndexItem = {
    ...base,
    ...patch,
    id: sessionId,
    title: nextTitle,
    titleSource: resolvedTitleSource,
    titleEditedAt: nextTitleEditedAt,
    createdAt: patch.createdAt ?? base.createdAt,
    updatedAt: patch.updatedAt ?? now,
    status: patch.status ?? base.status,
    lastOpenedAt: patch.lastOpenedAt ?? base.lastOpenedAt,
    pinned: patch.pinned ?? base.pinned,
  };
  if (!isSessionIndexItem(next)) {
    return;
  }
  const nextItems = [next, ...items.filter((item) => item.id !== sessionId)];
  writeSessionIndex(nextItems);
};

export const renameSession = (sessionId: string, title: string) => {
  const trimmed = title.trim();
  if (!trimmed) {
    return;
  }
  const items = readSessionIndex();
  const existing = items.find((item) => item.id === sessionId);
  if (!existing) {
    return;
  }
  const next: SessionIndexItem = {
    ...existing,
    title: normalizeTitle(trimmed),
    titleSource: "custom",
    titleEditedAt: new Date().toISOString(),
  };
  if (!isSessionIndexItem(next)) {
    return;
  }
  const nextItems = [next, ...items.filter((item) => item.id !== sessionId)];
  writeSessionIndex(nextItems);
};

export const touchSession = (sessionId: string) => {
  const items = readSessionIndex();
  const existing = items.find((item) => item.id === sessionId);
  if (!existing) {
    return;
  }
  const next: SessionIndexItem = {
    ...existing,
    lastOpenedAt: new Date().toISOString(),
  };
  if (!isSessionIndexItem(next)) {
    return;
  }
  const nextItems = [next, ...items.filter((item) => item.id !== sessionId)];
  writeSessionIndex(nextItems);
};

export const setSessionPinned = (sessionId: string, pinned: boolean) => {
  const items = readSessionIndex();
  const existing = items.find((item) => item.id === sessionId);
  if (!existing) {
    return;
  }
  const next: SessionIndexItem = {
    ...existing,
    pinned,
  };
  if (!isSessionIndexItem(next)) {
    return;
  }
  const nextItems = [next, ...items.filter((item) => item.id !== sessionId)];
  writeSessionIndex(nextItems);
};

export const listEmptySessions = (): SessionIndexItem[] => {
  const items = readSessionIndex();
  return items.filter((item) => {
    const detail = getSessionDetail(item.id);
    if (!detail) {
      return false;
    }
    const hasJob = Boolean(detail.jobId ?? item.jobId);
    if (hasJob) {
      return false;
    }
    const hasUserMessage = detail.messages.some(
      (message) => message.role === "user" && message.content.trim().length > 0
    );
    return !hasUserMessage;
  });
};

export const removeSession = (sessionId: string) => {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(getSessionDetailKey(sessionId));
  const items = readSessionIndex();
  writeSessionIndex(items.filter((item) => item.id !== sessionId));
  if (getActiveSessionId() === sessionId) {
    setActiveSessionId(null);
  }
};

export const onSessionsUpdate = (handler: () => void) => {
  if (typeof globalThis.addEventListener !== "function") {
    return () => {};
  }
  const listener = () => handler();
  globalThis.addEventListener("storage", listener);
  globalThis.addEventListener(SESSIONS_EVENT, listener as EventListener);
  return () => {
    globalThis.removeEventListener("storage", listener);
    globalThis.removeEventListener(SESSIONS_EVENT, listener as EventListener);
  };
};
