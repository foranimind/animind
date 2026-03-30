import { listRecentSessions, onSessionsUpdate } from "../lib/storage";
import type { SessionIndexItem } from "../lib/storage";
import { useStorageList } from "./useStorageList";

type SessionsResult = {
  items: SessionIndexItem[];
  refresh: () => void;
};

export const useSessions = (): SessionsResult =>
  useStorageList<SessionIndexItem>(listRecentSessions, onSessionsUpdate);
