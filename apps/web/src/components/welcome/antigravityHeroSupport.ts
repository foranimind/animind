const WEBGL_CONTEXT_NAMES = ["webgl2", "webgl", "experimental-webgl"] as const;

export const supportsAntigravityHeroWebGL = (): boolean => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");

    if (!canvas || typeof canvas.getContext !== "function") {
      return false;
    }

    for (const contextName of WEBGL_CONTEXT_NAMES) {
      try {
        const context = canvas.getContext(contextName);
        if (context) {
          return true;
        }
      } catch {
        // Some browsers or test environments throw for unsupported contexts.
      }
    }
  } catch {
    return false;
  }

  return false;
};
