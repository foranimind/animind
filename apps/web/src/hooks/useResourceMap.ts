import { useEffect, useState } from "react";

import { isNotFoundError, toErrorMessage } from "../lib/errors";
import type { LoadState } from "./useAsync";

type UseResourceMapOptions = {
  mapError?: (error: unknown) => string;
  isNotFound?: (error: unknown) => boolean;
};

const defaultMapError = (error: unknown) => toErrorMessage(error);
const defaultIsNotFound = (error: unknown) => isNotFoundError(error);

export const useResourceMap = <T>(
  keys: readonly string[],
  loader: (key: string) => Promise<T>,
  options: UseResourceMapOptions = {}
): Record<string, LoadState<T>> => {
  const mapError = options.mapError ?? defaultMapError;
  const isNotFound = options.isNotFound ?? defaultIsNotFound;
  const [map, setMap] = useState<Record<string, LoadState<T>>>({});

  useEffect(() => {
    let cancelled = false;
    const keySet = new Set(keys);
    setMap((prev) => {
      const next: Record<string, LoadState<T>> = {};
      let changed = false;
      for (const [key, value] of Object.entries(prev)) {
        if (keySet.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    keys.forEach((key) => {
      if (map[key]) {
        return;
      }
      setMap((prev) => (prev[key] ? prev : { ...prev, [key]: { status: "loading" } }));
      loader(key)
        .then((data) => {
          if (cancelled) {
            return;
          }
          setMap((prev) => ({ ...prev, [key]: { status: "ready", data } }));
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          setMap((prev) => ({
            ...prev,
            [key]: {
              status: "error",
              error: mapError(error),
              notFound: isNotFound ? isNotFound(error) : false,
            },
          }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [keys, loader, map, mapError, isNotFound]);

  return map;
};
