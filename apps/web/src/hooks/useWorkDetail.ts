import { useCallback } from "react";

import { fetchManifest, fetchPreviewConfig } from "../lib/api";
import { isNotFoundError, toErrorMessage } from "../lib/errors";
import { useResource, type LoadState } from "./useAsync";
import type { Manifest } from "../types/manifest";
import type { PreviewConfig } from "../types/previewConfig";

type WorkDetailResult = {
  manifest: LoadState<Manifest>;
  preview: LoadState<PreviewConfig>;
  reload: () => void;
};

export const useWorkDetail = (jobId?: string | null): WorkDetailResult => {
  const resolvedJobId = jobId ?? "";
  const enabled = Boolean(jobId);

  const loadManifest = useCallback(
    () => fetchManifest(resolvedJobId),
    [resolvedJobId]
  );
  const loadPreview = useCallback(
    () => fetchPreviewConfig(resolvedJobId),
    [resolvedJobId]
  );
  const mapManifestError = useCallback(
    (error: unknown) => toErrorMessage(error, "Failed to load manifest."),
    []
  );
  const mapPreviewError = useCallback(
    (error: unknown) => toErrorMessage(error, "Failed to load preview config."),
    []
  );

  const manifest = useResource(loadManifest, {
    enabled,
    mapError: mapManifestError,
    isNotFound: isNotFoundError,
  });

  const preview = useResource(loadPreview, {
    enabled,
    mapError: mapPreviewError,
  });

  const reload = useCallback(() => {
    manifest.reload();
    preview.reload();
  }, [manifest, preview]);

  return { manifest, preview, reload };
};
