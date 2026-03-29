import { Navigate } from "react-router-dom";

import { resolveSessionHref } from "../lib/sessionRouting";
import { getActiveSessionId, getSessionDetail } from "../lib/storage";
import { CreatePage } from "./CreatePage";

export const HomeRoute = () => {
  const activeSessionId = getActiveSessionId();
  const detail = activeSessionId ? getSessionDetail(activeSessionId) : null;
  const href =
    detail && (detail.status === "queued" || detail.status === "running")
      ? resolveSessionHref({ status: detail.status, jobId: detail.jobId })
      : "/";

  if (href !== "/") {
    return <Navigate to={href} replace />;
  }

  return <CreatePage />;
};
