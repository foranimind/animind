import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { CreateSettingsPanel } from "../components/create/CreateSettingsPanel";
import { PromptComposer } from "../components/create/PromptComposer";
import { PromptHelperBar } from "../components/create/PromptHelperBar";
import { RecoveredContextPanel } from "../components/create/RecoveredContextPanel";
import { PageHeader } from "../components/ui/PageHeader";
import { createJob } from "../lib/api";
import { ensureDraftSession } from "../lib/sessionActions";
import {
  getActiveSessionId,
  getSessionDetail,
  onSessionsUpdate,
  saveSessionDetail,
  setActiveSessionId,
  type SessionDetail,
} from "../lib/storage";
import "./pages.css";
import "./create.css";

const areSessionOptionsEqual = (left: SessionDetail["options"], right: SessionDetail["options"]) =>
  left.style === right.style &&
  left.mood === right.mood &&
  left.duration === right.duration &&
  left.exportPreset === right.exportPreset &&
  left.advancedSettings.model === right.advancedSettings.model &&
  left.advancedSettings.seed === right.advancedSettings.seed &&
  left.advancedSettings.resolution === right.advancedSettings.resolution;

const getPersistedPageDetail = (): SessionDetail => {
  const activeSessionId = getActiveSessionId();
  const activeDetail = activeSessionId ? getSessionDetail(activeSessionId) : null;
  if (
    activeDetail &&
    (activeDetail.status === "draft" ||
      activeDetail.status === "error" ||
      activeDetail.status === "canceled")
  ) {
    return activeDetail;
  }
  return ensureDraftSession();
};

export const CreatePage = () => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const hasRecovery = Boolean(detail?.recovery);

  useEffect(() => {
    const syncActiveSession = () => {
      const nextDetail = getPersistedPageDetail();
      const activeSessionChanged = activeSessionIdRef.current !== nextDetail.id;
      activeSessionIdRef.current = nextDetail.id;
      setDetail(nextDetail);
      if (activeSessionChanged) {
        setDraft(nextDetail.draft || nextDetail.lastPrompt || "");
      }
    };

    syncActiveSession();
    return onSessionsUpdate(syncActiveSession);
  }, []);

  useEffect(() => {
    if (!detail) {
      return;
    }
    const persisted = getSessionDetail(detail.id);
    const hasDraftChanged = (persisted?.draft ?? "") !== draft;
    const hasOptionChanges = !persisted || !areSessionOptionsEqual(persisted.options, detail.options);
    if (!hasDraftChanged && !hasOptionChanges) {
      return;
    }
    const now = new Date().toISOString();
    saveSessionDetail(
      {
        ...detail,
        draft,
        updatedAt: now,
      },
      {
        status: detail.status,
        jobId: detail.jobId,
        updatedAt: now,
      }
    );
  }, [detail, draft]);

  const canSubmit = draft.trim().length > 0;
  const createOptions = useMemo(
    () =>
      detail
        ? {
            style: detail.options.style,
            mood: detail.options.mood,
            duration_s: detail.options.duration,
            export_video: true,
            export_preset: detail.options.exportPreset,
            advanced: {
              model: detail.options.advancedSettings.model,
            },
          }
        : null,
    [detail]
  );

  const updateOptions = (updater: (current: SessionDetail["options"]) => SessionDetail["options"]) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            options: updater(current.options),
          }
        : current
    );
  };

  const handleInsert = (value: string) => {
    setDraft((current) => (current.trim().length > 0 ? `${current}\n${value}` : value));
  };

  const handleSubmit = async () => {
    const prompt = draft.trim();
    if (!detail || !createOptions || !prompt || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createJob(prompt, createOptions);
      const now = new Date().toISOString();
      const lastMessage = detail.messages[detail.messages.length - 1];
      const nextMessages =
        lastMessage?.role === "user" && lastMessage.content.trim() === prompt
          ? detail.messages
          : [...detail.messages, { id: `user-${now}`, role: "user" as const, content: prompt }];
      const nextDetail: SessionDetail = {
        ...detail,
        updatedAt: now,
        status: "queued",
        jobId: response.job_id,
        lastPrompt: prompt,
        messages: nextMessages,
        draft: prompt,
        recovery: undefined,
      };

      saveSessionDetail(nextDetail, {
        status: "queued",
        jobId: response.job_id,
        lastOpenedAt: now,
        updatedAt: now,
      });
      setActiveSessionId(nextDetail.id);
      setDetail(nextDetail);
      navigate(`/jobs/${encodeURIComponent(response.job_id)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!detail) {
    return (
      <div className="page create-page">
        <div className="create-launch-shell" />
      </div>
    );
  }

  return (
    <div className="page create-page">
      <PageHeader
        eyebrow="Create"
        title="创作台"
        description="整理场景、镜头、动作和情绪，然后直接发起新的生成任务。"
      />

      <div className={`create-desk-layout${hasRecovery ? " has-recovery" : ""}`}>
        {detail.recovery ? (
          <div className="create-desk-recovery">
            <RecoveredContextPanel recovery={detail.recovery} messages={detail.messages} />
          </div>
        ) : null}

        <section className="create-desk-main" aria-label="创作主区">
          <PromptComposer
            draft={draft}
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
            onDraftChange={setDraft}
            onSubmit={handleSubmit}
            helperBar={<PromptHelperBar onInsert={handleInsert} />}
          />
        </section>

        <aside className="create-desk-side" aria-label="创作设置">
          <CreateSettingsPanel
            options={detail.options}
            onStyleChange={(value) =>
              updateOptions((current) => ({
                ...current,
                style: value,
              }))
            }
            onMoodChange={(value) =>
              updateOptions((current) => ({
                ...current,
                mood: value,
              }))
            }
            onDurationChange={(value) =>
              updateOptions((current) => ({
                ...current,
                duration: value,
              }))
            }
          />
        </aside>
      </div>
    </div>
  );
};
