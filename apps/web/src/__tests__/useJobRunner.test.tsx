import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { JobEvent, JobStatus } from "../types/job";

let capturedHandler: ((event: JobEvent) => void) | null = null;
const closeSpy = vi.fn();

vi.mock("../lib/api", () => ({
  createJob: vi.fn(() => Promise.resolve({ job_id: "job_test" })),
  getJob: vi.fn(),
  subscribeJobEvents: vi.fn(
    (
      _jobId: string,
      onEvent: (event: JobEvent) => void,
      handlers: { onConnectionChange?: (state: "connected" | "disconnected") => void } = {}
    ) => {
      capturedHandler = onEvent;
      handlers.onConnectionChange?.("connected");
      return { close: closeSpy };
    }
  ),
}));

import { useJobRunner } from "../hooks/useJobRunner";

type Snapshot = {
  jobStatus: JobStatus | null;
  connectionState: string;
};

const RunnerProbe = ({ onState }: { onState: (snapshot: Snapshot) => void }) => {
  const { start, jobStatus, connectionState } = useJobRunner("Hello", {});

  useEffect(() => {
    start().catch(() => null);
  }, [start]);

  useEffect(() => {
    onState({ jobStatus, connectionState });
  }, [jobStatus, connectionState, onState]);

  return null;
};

describe("useJobRunner", () => {
  beforeEach(() => {
    capturedHandler = null;
    closeSpy.mockClear();
  });

  it("applies status from events and treats canceled as terminal", async () => {
    let latest: Snapshot | null = null;
    render(<RunnerProbe onState={(snapshot) => (latest = snapshot)} />);

    await waitFor(() => expect(capturedHandler).not.toBeNull());

    act(() => {
      capturedHandler?.({
        type: "progress",
        data: { status: "CANCELED", progress: 8, stage: "RUNNING_SCENE" },
      });
    });

    await waitFor(() => expect(latest?.jobStatus?.status).toBe("CANCELED"));
    await waitFor(() => expect(latest?.connectionState).toBe("idle"));
    expect(closeSpy).toHaveBeenCalled();
  });
});
