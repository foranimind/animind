import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { CreateSettingsPanel } from "../components/create/CreateSettingsPanel";
import { PromptComposer } from "../components/create/PromptComposer";
import { PromptHelperBar } from "../components/create/PromptHelperBar";
import { RecoveredContextPanel } from "../components/create/RecoveredContextPanel";
import { createJob } from "../lib/api";
import { createNewSession } from "../lib/sessionActions";
import {
  getActiveSessionId,
  getSessionDetail,
  onSessionsUpdate,
  saveSessionDetail,
  setActiveSessionId,
  type SessionDetail,
} from "../lib/storage";
import "./pages.css";

const getPersistedPageDetail = (): SessionDetail => {
  const activeSessionId = getActiveSessionId();
  const activeDetail = activeSessionId ? getSessionDetail(activeSessionId) : null;
  return activeDetail ?? createNewSession();
};

export const CreatePage = () => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeSessionIdRef = useRef<string | null>(null);

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
      <div className="create-launch-shell">
        <RecoveredContextPanel recovery={detail.recovery} messages={detail.messages} />

        <PromptComposer
          draft={draft}
          canSubmit={canSubmit}
          isSubmitting={isSubmitting}
          onDraftChange={setDraft}
          onSubmit={handleSubmit}
        />

        <PromptHelperBar onInsert={handleInsert} />

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
      </div>
    </div>
  );
};
