import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { RunActionBar } from "../components/run/RunActionBar";
import { RunLogPanel } from "../components/run/RunLogPanel";
import { RunPreviewPane } from "../components/run/RunPreviewPane";
import { RunTimelinePanel } from "../components/run/RunTimelinePanel";
import { useJobRunner } from "../hooks/useJobRunner";
import { cancelJob } from "../lib/api";
import {
  getSessionDetail,
  listSessions,
  saveSessionDetail,
  setActiveSessionId,
} from "../lib/storage";
import { resolveJobStageLabel } from "../lib/status";

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
  const logLines =
    jobStatus?.logs_tail && jobStatus.logs_tail.length > 0
      ? jobStatus.logs_tail
      : jobStatus?.message
        ? [jobStatus.message]
        : [];

  return (
    <div className="page job-run-page">
      <div className="job-run-shell">
        <div className="job-run-process-column">
          <RunTimelinePanel status={jobStatus} />
          <RunLogPanel lines={logLines} />
          <RunActionBar
            canCancel={canCancel}
            isCanceling={isCanceling}
            onCancel={handleCancel}
          />
        </div>

        <div className="job-run-preview-column">
          <RunPreviewPane jobId={id} status={jobStatus} />
        </div>
      </div>
    </div>
  );
};
