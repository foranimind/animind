import { useCallback, useEffect, useState } from "react";

type StorageListResult<T> = {
  items: T[];
  refresh: () => void;
};

export const useStorageList = <T>(
  listFn: () => T[],
  subscribeFn: (handler: () => void) => () => void
): StorageListResult<T> => {
  const [items, setItems] = useState<T[]>(() => listFn());

  const refresh = useCallback(() => {
    setItems(listFn());
  }, [listFn]);

  useEffect(() => subscribeFn(refresh), [refresh, subscribeFn]);

  return { items, refresh };
};
