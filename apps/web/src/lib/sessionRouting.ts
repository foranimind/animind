import type { SessionDetail, SessionStatus } from "./storage";

const isRecoverableJobStatus = (status: SessionStatus) => status === "queued" || status === "running";

export const getRecoverableSessionHref = (
  detail: Pick<SessionDetail, "status" | "jobId"> | null | undefined
) => {
  if (!detail?.jobId || !isRecoverableJobStatus(detail.status)) {
    return undefined;
  }
  return `/jobs/${encodeURIComponent(detail.jobId)}`;
};

export const resolveSessionHref = ({
  status,
  jobId,
}: {
  status: SessionStatus;
  jobId?: string;
}) => {
  const recoverableHref = getRecoverableSessionHref({ status, jobId });
  if (recoverableHref) {
    return recoverableHref;
  }
  if (!jobId || status === "draft" || status === "error" || status === "canceled") {
    return "/studio";
  }
  const encodedJobId = encodeURIComponent(jobId);
  if (status === "done") {
    return `/works/${encodedJobId}`;
  }
  return "/studio";
};
