export const toErrorMessage = (error: unknown, fallback = "Request failed.") => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
};

export const getErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  if (error instanceof Response) {
    return error.status;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
};

export const isNotFoundError = (error: unknown): boolean => {
  const status = getErrorStatus(error);
  if (status === 404) {
    return true;
  }
  if (error instanceof Error && /not found|404/i.test(error.message)) {
    return true;
  }
  return false;
};
