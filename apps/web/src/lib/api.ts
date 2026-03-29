import { z } from "zod";

import { jobEventSchema, parseJobStatus } from "../types/job";
import type { JobEvent } from "../types/job";
import { normalizeManifest } from "../types/manifest";
import type { CreateJobOptions } from "../types/options";
import { parsePreviewConfig } from "../types/previewConfig";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "1";
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");
const EFFECTIVE_BASE = USE_MOCK ? "" : API_BASE;
const DEFAULT_TIMEOUT_MS = 15000;
const MOCK_JOB_ID = "demo_job";
const ASSET_ROOT = USE_MOCK ? "/mock/assets" : "/assets";
const MOCK_LOG_LINES = [
  "Queued demo job.",
  "Planning prompt and options.",
  "Generating motion BVH.",
  "Rendering panorama scene.",
  "Mixing music track.",
  "Finalizing manifest.",
];
const MOCK_STAGE_SEQUENCE = [
  { stage: "PLANNING", progress: 8 },
  { stage: "RUNNING_MOTION", progress: 35 },
  { stage: "RUNNING_SCENE", progress: 60 },
  { stage: "RUNNING_MUSIC", progress: 82 },
  { stage: "DONE", progress: 100 },
];

type JsonBody = Record<string, unknown>;

type FetchOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | JsonBody | null;
  timeoutMs?: number;
};

const isAbsoluteUrl = (value: string): boolean =>
  /^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:");

const resolveApiUrl = (path: string): string => {
  if (isAbsoluteUrl(path)) {
    return path;
  }
  if (!path.startsWith("/")) {
    return `${EFFECTIVE_BASE}/${path}`;
  }
  return `${EFFECTIVE_BASE}${path}`;
};

const resolveWebSocketUrl = (path: string): string => {
  const httpUrl = resolveApiUrl(path);
  if (httpUrl.startsWith("https://")) {
    return httpUrl.replace(/^https:/, "wss:");
  }
  if (httpUrl.startsWith("http://")) {
    return httpUrl.replace(/^http:/, "ws:");
  }
  if (httpUrl.startsWith("/") && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${httpUrl}`;
  }
  return httpUrl;
};

const resolveAssetUrl = (uriOrPath: string): string => {
  if (isAbsoluteUrl(uriOrPath)) {
    return uriOrPath;
  }
  if (!uriOrPath.startsWith("/")) {
    return resolveApiUrl(`${ASSET_ROOT}/${uriOrPath}`);
  }
  if (USE_MOCK && uriOrPath.startsWith("/assets/")) {
    return resolveApiUrl(uriOrPath.replace(/^\/assets/, ASSET_ROOT));
  }
  return resolveApiUrl(uriOrPath);
};

const isJsonBody = (body: unknown): body is Record<string, unknown> => {
  if (!body || typeof body !== "object") {
    return false;
  }
  return (
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !(body instanceof URLSearchParams)
  );
};

const parseMaybeJson = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => null);
};

const extractErrorMessage = (payload: unknown, fallback: string): string => {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message =
      (typeof record.message === "string" && record.message) ||
      (typeof record.detail === "string" && record.detail) ||
      (typeof record.error === "string" && record.error);
    if (message) {
      return message;
    }
  }
  return fallback;
};

const fetchJson = async <T>(url: string, options: FetchOptions = {}): Promise<T> => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, body, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  let resolvedBody: BodyInit | null | undefined = body as BodyInit | null | undefined;
  const headerBag = new Headers(headers);

  if (!headerBag.has("Accept")) {
    headerBag.set("Accept", "application/json");
  }

  if (isJsonBody(body)) {
    resolvedBody = JSON.stringify(body);
    if (!headerBag.has("Content-Type")) {
      headerBag.set("Content-Type", "application/json");
    }
  }

  try {
    const response = await fetch(url, {
      ...rest,
      headers: headerBag,
      body: resolvedBody,
      signal: controller.signal,
    });
    const payload = await parseMaybeJson(response);
    if (!response.ok) {
      const message = extractErrorMessage(payload, response.statusText || "Request failed");
      const error = new Error(message);
      (error as { status?: number; payload?: unknown }).status = response.status;
      (error as { status?: number; payload?: unknown }).payload = payload;
      throw error;
    }
    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const createJobResponseSchema = z.object({
  job_id: z.string(),
});

type CreateJobResponse = z.infer<typeof createJobResponseSchema>;

const mockEvents = (
  jobId: string
): Array<{
  delayMs: number;
  type: z.infer<typeof jobEventSchema>["type"];
  data: Record<string, unknown>;
}> => {
  const events: Array<{
    delayMs: number;
    type: z.infer<typeof jobEventSchema>["type"];
    data: Record<string, unknown>;
  }> = [];
  const logs: string[] = [];
  let delay = 200;

  MOCK_STAGE_SEQUENCE.forEach((entry, index) => {
    const logLine = MOCK_LOG_LINES[index] ?? `Stage ${entry.stage}`;
    logs.push(logLine);
    events.push({
      delayMs: delay,
      type: "log",
      data: { level: "info", text: logLine, logs_tail: logs.slice(-6) },
    });
    delay += 350;
    const payload = {
      stage: entry.stage,
      progress: entry.progress,
      logs_tail: logs.slice(-6),
    };
    if (entry.stage === "DONE") {
      events.push({
        delayMs: delay,
        type: "done",
        data: {
          ...payload,
          manifest_url: `${ASSET_ROOT}/${jobId}/manifest.json`,
        },
      });
    } else {
      events.push({ delayMs: delay, type: "progress", data: payload });
    }
    delay += 700;
  });

  return events;
};

const mapSseType = (rawType: string): z.infer<typeof jobEventSchema>["type"] => {
  switch (rawType) {
    case "stage":
      return "stage";
    case "log":
      return "log";
    case "progress":
      return "progress";
    case "done":
      return "done";
    case "error":
      return "error";
    case "status":
      return "progress";
    case "failed":
      return "error";
    case "asset":
      return "progress";
    default:
      return "log";
  }
};

type JobEventHandlers = {
  onConnectionChange?: (state: "connected" | "disconnected") => void;
  onTransportChange?: (transport: "sse" | "ws") => void;
};

const coerceLogLines = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const lines = value.filter((entry) => typeof entry === "string");
  return lines.length > 0 ? lines : undefined;
};

const normalizeWsPayload = (payload: unknown): JobEvent[] => {
  if (!payload || typeof payload !== "object") {
    return [{ type: "log", data: payload }];
  }
  const record = payload as Record<string, unknown>;
  const status = typeof record.status === "string" ? record.status : undefined;
  const progress = typeof record.progress === "number" ? record.progress : undefined;
  const hint = typeof record.hint === "string" ? record.hint : undefined;
  const error = typeof record.error === "string" ? record.error : undefined;
  const rawQueue =
    record.queue_position ?? record.queuePosition ?? record.queue_index ?? record.queueIndex ?? record.queue;
  const queuePosition =
    typeof rawQueue === "number"
      ? rawQueue
      : typeof rawQueue === "string"
        ? Number(rawQueue)
        : undefined;
  const logsTail = coerceLogLines(record.logs_tail) ?? coerceLogLines(record.hints);
  const previewUrl = typeof record.preview_url === "string" ? record.preview_url : undefined;
  const audioUrl = typeof record.audio_url === "string" ? record.audio_url : undefined;
  const bvhUrl =
    typeof record.bvh_download_url === "string"
      ? record.bvh_download_url
      : typeof record.download_url === "string"
        ? record.download_url
        : undefined;
  const mp4List = Array.isArray(record.mp4_list)
    ? record.mp4_list.filter((item) => typeof item === "string")
    : undefined;
  const zipUrl = typeof record.zip_url === "string" ? record.zip_url : undefined;

  const baseData: Record<string, unknown> = {};
  if (status) {
    baseData.stage = status;
    baseData.status = status;
  }
  if (typeof progress === "number") {
    baseData.progress = progress;
  }
  if (queuePosition !== undefined && !Number.isNaN(queuePosition)) {
    baseData.queue_position = queuePosition;
  }
  if (logsTail) {
    baseData.logs_tail = logsTail;
  }
  if (hint) {
    baseData.message = hint;
  }
  if (previewUrl) {
    baseData.preview_url = previewUrl;
  }
  if (audioUrl) {
    baseData.audio_url = audioUrl;
  }
  if (bvhUrl) {
    baseData.bvh_download_url = bvhUrl;
  }
  if (mp4List) {
    baseData.mp4_list = mp4List;
  }
  if (zipUrl) {
    baseData.zip_url = zipUrl;
  }

  const events: JobEvent[] = [];
  if (hint || logsTail) {
    events.push({
      type: "log",
      data: { message: hint, logs_tail: logsTail, status },
    });
  }

  const normalizedStatus = status?.toUpperCase();
  if (error) {
    events.push({ type: "error", data: { ...baseData, message: error } });
  } else if (normalizedStatus === "COMPLETED" || normalizedStatus === "DONE") {
    events.push({ type: "done", data: baseData });
  } else if (normalizedStatus === "FAILED" || normalizedStatus === "ERROR") {
    events.push({
      type: "error",
      data: { ...baseData, message: hint ?? "Job failed" },
    });
  } else if (status || typeof progress === "number") {
    events.push({ type: "progress", data: baseData });
  }

  return events.length > 0 ? events : [{ type: "log", data: payload }];
};

export const getAssetUrl = (uriOrPath: string): string => resolveAssetUrl(uriOrPath);

export const createJob = async (
  prompt: string,
  options: Record<string, unknown> | CreateJobOptions = {}
): Promise<CreateJobResponse> => {
  if (USE_MOCK) {
    return { job_id: MOCK_JOB_ID };
  }
  const payload: Record<string, unknown> = { prompt };
  if (options && Object.keys(options).length > 0) {
    payload.options = options;
  }
  try {
    const response = await fetchJson<CreateJobResponse>(resolveApiUrl("/api/jobs"), {
      method: "POST",
      body: payload,
    });
    return createJobResponseSchema.parse(response);
  } catch (error) {
    const status = (error as { status?: number }).status;
    const shouldFallback = status === 404 || status === undefined;
    if (!shouldFallback) {
      throw error;
    }
    const comboPayload: Record<string, unknown> = { text: prompt };
    const duration =
      typeof (options as { duration_s?: unknown }).duration_s === "number"
        ? Number((options as { duration_s: number }).duration_s)
        : undefined;
    if (duration !== undefined) {
      comboPayload.duration = Math.round(duration);
    }
    const response = await fetchJson<CreateJobResponse>(resolveApiUrl("/combo/submit"), {
      method: "POST",
      body: comboPayload,
    });
    return createJobResponseSchema.parse(response);
  }
};

export const getJob = async (jobId: string) => {
  if (USE_MOCK) {
    return parseJobStatus({
      status: "DONE",
      stage: "DONE",
      progress: 100,
      message: "mock job",
      logs_tail: MOCK_LOG_LINES.slice(-6),
    });
  }
  const loadJob = async (path: string) => {
    const response = await fetchJson<unknown>(resolveApiUrl(path));
    const parsed = parseJobStatus(response);
    if (response && typeof response === "object") {
      const record = response as Record<string, unknown>;
      const hint = typeof record.hint === "string" ? record.hint : undefined;
      const hints = Array.isArray(record.hints)
        ? record.hints.filter((line) => typeof line === "string")
        : undefined;
      if (hint || (hints && hints.length > 0)) {
        return {
          ...parsed,
          message: parsed.message ?? hint,
          logs_tail: parsed.logs_tail ?? hints,
        };
      }
    }
    return parsed;
  };

  try {
    return await loadJob(`/api/jobs/${encodeURIComponent(jobId)}`);
  } catch (error) {
    const status = (error as { status?: number }).status;
    const shouldFallback = status === 404 || status === undefined;
    if (!shouldFallback) {
      throw error;
    }
    return loadJob(`/jobs/${encodeURIComponent(jobId)}`);
  }
};

export const subscribeJobEvents = (
  jobId: string,
  onEvent: (ev: JobEvent) => void,
  handlers: JobEventHandlers = {}
) => {
  if (USE_MOCK) {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    handlers.onConnectionChange?.("connected");
    for (const entry of mockEvents(jobId)) {
      const timer = globalThis.setTimeout(() => {
        const result = jobEventSchema.safeParse({ type: entry.type, data: entry.data });
        if (result.success) {
          onEvent(result.data);
        }
      }, entry.delayMs);
      timers.push(timer);
    }
    return {
      close() {
        timers.forEach((timer) => globalThis.clearTimeout(timer));
      },
    };
  }

  let closed = false;
  let source: EventSource | null = null;
  let socket: WebSocket | null = null;
  let sseOpened = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let wsRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let wsRetryCount = 0;

  const reportConnected = () => handlers.onConnectionChange?.("connected");
  const reportDisconnected = () => handlers.onConnectionChange?.("disconnected");

  const handleSseEvent = (rawType: string, rawData: string) => {
    const parsedData = (() => {
      try {
        return JSON.parse(rawData);
      } catch {
        return rawData;
      }
    })();
    const mappedType = mapSseType(rawType);
    const result = jobEventSchema.safeParse({ type: mappedType, data: parsedData });
    if (result.success) {
      onEvent(result.data);
      reportConnected();
    } else {
      onEvent({ type: "error", data: { message: "Invalid event payload", rawType } });
    }
  };

  const connectWs = () => {
    if (closed) {
      return;
    }
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    handlers.onTransportChange?.("ws");
    const wsUrl = resolveWebSocketUrl(`/ws/jobs/${encodeURIComponent(jobId)}`);
    socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      wsRetryCount = 0;
      if (wsRetryTimer !== null) {
        globalThis.clearTimeout(wsRetryTimer);
        wsRetryTimer = null;
      }
      reportConnected();
    };
    socket.onmessage = (event) => {
      const parsedData = (() => {
        try {
          return JSON.parse(event.data as string);
        } catch {
          return event.data;
        }
      })();
      normalizeWsPayload(parsedData).forEach(onEvent);
      reportConnected();
    };
    socket.onerror = () => {
      if (closed) {
        return;
      }
      reportDisconnected();
      scheduleWsReconnect();
    };
    socket.onclose = () => {
      if (closed) {
        return;
      }
      reportDisconnected();
      scheduleWsReconnect();
    };
  };

  const scheduleWsReconnect = () => {
    if (closed || wsRetryTimer !== null) {
      return;
    }
    wsRetryCount += 1;
    const delay = Math.min(2000 * wsRetryCount, 10000);
    wsRetryTimer = globalThis.setTimeout(() => {
      wsRetryTimer = null;
      connectWs();
    }, delay);
  };

  const connectSse = () => {
    if (closed) {
      return;
    }
    handlers.onTransportChange?.("sse");
    const url = resolveApiUrl(`/api/jobs/${encodeURIComponent(jobId)}/events`);
    source = new EventSource(url);
    fallbackTimer = globalThis.setTimeout(() => {
      if (!sseOpened && !closed) {
        source?.close();
        connectWs();
      }
    }, 2500);
    source.onopen = () => {
      sseOpened = true;
      if (fallbackTimer !== null) {
        globalThis.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      reportConnected();
    };
    source.onmessage = (event) => handleSseEvent("message", event.data);
    source.addEventListener("status", (event) =>
      handleSseEvent("status", (event as MessageEvent).data)
    );
    source.addEventListener("log", (event) =>
      handleSseEvent("log", (event as MessageEvent).data)
    );
    source.addEventListener("asset", (event) =>
      handleSseEvent("asset", (event as MessageEvent).data)
    );
    source.addEventListener("done", (event) =>
      handleSseEvent("done", (event as MessageEvent).data)
    );
    source.addEventListener("failed", (event) =>
      handleSseEvent("failed", (event as MessageEvent).data)
    );
    source.onerror = () => {
      if (closed) {
        return;
      }
      reportDisconnected();
      source?.close();
      if (fallbackTimer !== null) {
        globalThis.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      connectWs();
    };
  };

  connectSse();

  return {
    close() {
      closed = true;
      if (fallbackTimer !== null) {
        globalThis.clearTimeout(fallbackTimer);
      }
      if (wsRetryTimer !== null) {
        globalThis.clearTimeout(wsRetryTimer);
      }
      source?.close();
      socket?.close();
    },
  };
};

export const fetchManifest = async (jobId: string) => {
  const url = resolveAssetUrl(`/assets/${encodeURIComponent(jobId)}/manifest.json`);
  const response = await fetchJson<unknown>(url);
  return normalizeManifest(response);
};

export const fetchPreviewConfig = async (jobId: string) => {
  const url = resolveAssetUrl(`/assets/${encodeURIComponent(jobId)}/preview/preview_config.json`);
  const response = await fetchJson<unknown>(url);
  return parsePreviewConfig(response);
};

export const cancelJob = async (jobId: string, message?: string) => {
  if (USE_MOCK) {
    return parseJobStatus({
      status: "CANCELED",
      stage: "CANCELED",
      progress: 0,
      message: message ?? "canceled",
    });
  }
  const payload = message ? { message } : undefined;
  const response = await fetchJson<unknown>(
    resolveApiUrl(`/api/jobs/${encodeURIComponent(jobId)}/cancel`),
    {
      method: "POST",
      body: payload ?? null,
    }
  );
  return parseJobStatus(response);
};
