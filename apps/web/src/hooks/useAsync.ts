import { useCallback, useEffect, useState } from "react";

import { isNotFoundError, toErrorMessage } from "../lib/errors";

export type LoadState<T> = {
  status: "idle" | "loading" | "ready" | "error";
  data?: T;
  error?: string;
  notFound?: boolean;
};

type UseAsyncOptions = {
  enabled?: boolean;
  mapError?: (error: unknown) => string;
  isNotFound?: (error: unknown) => boolean;
};

type UseAsyncResult<T> = LoadState<T> & {
  reload: () => void;
};

export const useAsync = <T>(
  loader: () => Promise<T>,
  options: UseAsyncOptions = {}
): UseAsyncResult<T> => {
  const {
    enabled = true,
    mapError = (error) => toErrorMessage(error),
    isNotFound = isNotFoundError,
  } = options;
  const [state, setState] = useState<LoadState<T>>(() =>
    enabled ? { status: "loading" } : { status: "idle" }
  );
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    loader()
      .then((data) => {
        if (cancelled) {
          return;
        }
        setState({ status: "ready", data });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          status: "error",
          error: mapError(error),
          notFound: isNotFound ? isNotFound(error) : false,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, isNotFound, loader, mapError, reloadToken]);

  return { ...state, reload };
};

export const useResource = useAsync;
