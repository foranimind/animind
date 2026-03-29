import "./pages.css";
import "./run.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { RunActionBar } from "../components/run/RunActionBar";
import { RunLogPanel } from "../components/run/RunLogPanel";
import { RunPreviewPane } from "../components/run/RunPreviewPane";
import { RunTimelinePanel } from "../components/run/RunTimelinePanel";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { useJobRunner } from "../hooks/useJobRunner";
import { cancelJob } from "../lib/api";
import {
  getSessionDetail,
  listSessions,
  saveSessionDetail,
  setActiveSessionId,
} from "../lib/storage";
import { resolveJobStageLabel } from "../lib/status";
import type { StatusTone } from "../lib/status";

const EMPTY_OPTIONS = {};
const TERMINAL_DONE = new Set(["DONE", "COMPLETED"]);
const TERMINAL_ERROR = new Set(["FAILED", "ERROR"]);
const TERMINAL_CANCELED = new Set(["CANCELED", "CANCELLED"]);

export const JobRunPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isCanceling, setIsCanceling] = useState(false);
  const handledTerminalRef = useRef<string | null>(null);
  const { jobStatus, error, subscribeExistingJob } = useJobRunner("", EMPTY_OPTIONS);

  useEffect(() => {
    if (id) {
      subscribeExistingJob(id).catch(() => null);
    }
  }, [id, subscribeExistingJob]);

  const sessionId = useMemo(
    () => listSessions().find((item) => item.jobId === id)?.id ?? null,
    [id]
  );

  const applyTerminalTransition = useCallback(
    (normalizedStatus: string, message?: string, stage?: string) => {
      if (!id || !sessionId) {
        return;
      }

      const terminalKey = `${id}:${normalizedStatus}`;
      if (handledTerminalRef.current === terminalKey) {
        return;
      }

      const detail = getSessionDetail(sessionId);
      if (!detail) {
        return;
      }

      const now = new Date().toISOString();
      handledTerminalRef.current = terminalKey;

      if (TERMINAL_DONE.has(normalizedStatus)) {
        saveSessionDetail(
          {
            ...detail,
            updatedAt: now,
            status: "done",
            jobId: id,
            recovery: undefined,
          },
          { status: "done", jobId: id, updatedAt: now }
        );
        setActiveSessionId(sessionId);
        navigate(`/works/${encodeURIComponent(id)}`, { replace: true });
        return;
      }

      if (TERMINAL_ERROR.has(normalizedStatus) || TERMINAL_CANCELED.has(normalizedStatus)) {
        const reason = TERMINAL_CANCELED.has(normalizedStatus) ? "canceled" : "error";
        saveSessionDetail(
          {
            ...detail,
            updatedAt: now,
            status: reason,
            jobId: id,
            recovery: {
              reason,
              message,
              stage: resolveJobStageLabel(stage, normalizedStatus),
              updatedAt: now,
            },
          },
          { status: reason, jobId: id, updatedAt: now }
        );
        setActiveSessionId(sessionId);
        navigate("/", { replace: true });
      }
    },
    [id, navigate, sessionId]
  );

  useEffect(() => {
    const normalizedStatus = jobStatus?.status?.toUpperCase();
    if (!id || !normalizedStatus || !sessionId) {
      return;
    }
    applyTerminalTransition(
      normalizedStatus,
      error ?? jobStatus?.message,
      jobStatus?.stage ?? jobStatus?.status
    );
  }, [applyTerminalTransition, error, id, jobStatus, sessionId]);

  const handleCancel = async () => {
    if (!id || isCanceling) {
      return;
    }
    setIsCanceling(true);
    try {
      const nextStatus = await cancelJob(id, "用户取消");
      const normalizedStatus = nextStatus.status?.toUpperCase();
      if (normalizedStatus) {
        applyTerminalTransition(
          normalizedStatus,
          nextStatus.message,
          nextStatus.stage ?? nextStatus.status
        );
      }
    } finally {
      setIsCanceling(false);
    }
  };

  const normalizedStatus = jobStatus?.status?.toUpperCase() ?? "";
  const canCancel = !TERMINAL_DONE.has(normalizedStatus) && !TERMINAL_ERROR.has(normalizedStatus) && !TERMINAL_CANCELED.has(normalizedStatus);
  const statusTone: StatusTone = !normalizedStatus
    ? "idle"
    : canCancel
      ? "loading"
      : TERMINAL_DONE.has(normalizedStatus)
        ? "ready"
        : TERMINAL_ERROR.has(normalizedStatus) || TERMINAL_CANCELED.has(normalizedStatus)
          ? "error"
          : "warning";
  const statusLabel = resolveJobStageLabel(jobStatus?.stage, normalizedStatus || jobStatus?.status);
  const logLines =
    jobStatus?.logs_tail && jobStatus.logs_tail.length > 0
      ? jobStatus.logs_tail
      : jobStatus?.message
        ? [jobStatus.message]
        : [];

  return (
    <div className="page job-run-page">
      <PageHeader
        eyebrow="Execution Theater"
        title="执行剧场"
        description="预览占据主舞台，进度、日志与控制作为配套叙事面板持续更新。"
        accessory={<StatusPill tone={statusTone}>{statusLabel}</StatusPill>}
      />

      <div className="run-stage-layout">
        <section className="run-stage-support" aria-label="执行进度">
          <RunTimelinePanel status={jobStatus} />
          <RunLogPanel lines={logLines} />
          <RunActionBar
            canCancel={canCancel}
            isCanceling={isCanceling}
            onCancel={handleCancel}
          />
        </section>

        <section className="run-stage-main" aria-label="预览舞台">
          <RunPreviewPane jobId={id} status={jobStatus} />
        </section>
      </div>
    </div>
  );
};
