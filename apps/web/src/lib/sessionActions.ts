import {
  findLatestDraftSessionDetail,
  getActiveSessionId,
  getSessionDetail,
  pruneEmptyDraftSessions,
  saveSessionDetail,
  setActiveSessionId,
  setDraftSessionId,
} from "./storage";
import { buildDefaultSessionDetail, createSessionId } from "./sessionDefaults";

const createDraftSession = () => {
  const now = new Date().toISOString();
  const sessionId = createSessionId();
  const detail = buildDefaultSessionDetail(sessionId, now);
  saveSessionDetail(detail, { lastOpenedAt: now, titleSource: "auto" });
  setDraftSessionId(sessionId);
  setActiveSessionId(sessionId);
  return detail;
};

export const createNewSession = () => {
  pruneEmptyDraftSessions();
  return createDraftSession();
};

export const ensureDraftSession = () => {
  const activeSessionId = getActiveSessionId();
  const activeDetail = activeSessionId ? getSessionDetail(activeSessionId) : null;
  if (activeDetail?.status === "draft" && !activeDetail.jobId) {
    setDraftSessionId(activeDetail.id);
    pruneEmptyDraftSessions(activeDetail.id);
    return activeDetail;
  }

  const latestDraft = findLatestDraftSessionDetail();
  if (latestDraft) {
    setDraftSessionId(latestDraft.id);
    setActiveSessionId(latestDraft.id);
    pruneEmptyDraftSessions(latestDraft.id);
    return latestDraft;
  }

  return createDraftSession();
};
