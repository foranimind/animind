import { Navigate } from "react-router-dom";

import { getRecoverableSessionHref } from "../lib/sessionRouting";
import { getActiveSessionId, getSessionDetail } from "../lib/storage";
import { CreatePage } from "./CreatePage";

export const StudioRoute = () => {
  const activeSessionId = getActiveSessionId();
  const detail = activeSessionId ? getSessionDetail(activeSessionId) : null;
  const href = getRecoverableSessionHref(detail);

  if (href) {
    return <Navigate to={href} replace />;
  }

  return <CreatePage />;
};
