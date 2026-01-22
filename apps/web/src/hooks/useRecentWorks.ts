import { listRecentWorks, onRecentWorksUpdate } from "../lib/storage";
import type { RecentWork } from "../lib/storage";
import { useStorageList } from "./useStorageList";

type RecentWorksResult = {
  items: RecentWork[];
  refresh: () => void;
};

export const useRecentWorks = (): RecentWorksResult =>
  useStorageList<RecentWork>(listRecentWorks, onRecentWorksUpdate);
