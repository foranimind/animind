import { useCallback } from "react";

import { fetchPreviewConfig } from "../lib/api";
import { toErrorMessage } from "../lib/errors";
import { useResource } from "./useAsync";

export const usePreviewConfig = (jobId?: string | null) => {
  const resolvedJobId = jobId ?? "";
  const enabled = Boolean(jobId);

  const loadPreview = useCallback(
    () => fetchPreviewConfig(resolvedJobId),
    [resolvedJobId]
  );
  const mapPreviewError = useCallback(
    (error: unknown) => toErrorMessage(error, "Failed to load preview config."),
    []
  );

  return useResource(loadPreview, {
    enabled,
    mapError: mapPreviewError,
  });
};
