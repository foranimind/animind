import { saveSessionDetail, setActiveSessionId } from "./storage";
import { buildDefaultSessionDetail, createSessionId } from "./sessionDefaults";

export const createNewSession = () => {
  const now = new Date().toISOString();
  const sessionId = createSessionId();
  const detail = buildDefaultSessionDetail(sessionId, now);
  saveSessionDetail(detail, { lastOpenedAt: now, titleSource: "auto" });
  setActiveSessionId(sessionId);
  return detail;
};
