import type { SessionStatus } from "./storage";

const isRecoverableJobStatus = (status: SessionStatus) => status === "queued" || status === "running";

export const resolveSessionHref = ({
  status,
  jobId,
}: {
  status: SessionStatus;
  jobId?: string;
}) => {
  if (!jobId || status === "draft" || status === "error" || status === "canceled") {
    return "/";
  }
  const encodedJobId = encodeURIComponent(jobId);
  if (status === "done") {
    return `/works/${encodedJobId}`;
  }
  if (isRecoverableJobStatus(status)) {
    return `/jobs/${encodedJobId}`;
  }
  return "/";
};
