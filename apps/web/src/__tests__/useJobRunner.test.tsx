import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { JobEvent, JobStatus } from "../types/job";

const STABLE_OPTIONS = {};

let capturedHandler: ((event: JobEvent) => void) | null = null;
const closeSpy = vi.fn();

vi.mock("../lib/api", () => ({
  createJob: vi.fn(() => Promise.resolve({ job_id: "job_test", queue_position: 2 })),
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
import { getJob } from "../lib/api";

type Snapshot = {
  jobStatus: JobStatus | null;
  connectionState: string;
};

const RunnerProbe = ({ onState }: { onState: (snapshot: Snapshot) => void }) => {
  const { start, jobStatus, connectionState } = useJobRunner("Hello", STABLE_OPTIONS);

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
    vi.clearAllMocks();
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

  it("hydrates the queued position from the create-job response", async () => {
    let latest: Snapshot | null = null;
    render(<RunnerProbe onState={(snapshot) => (latest = snapshot)} />);

    await waitFor(() => expect(capturedHandler).not.toBeNull());
    await waitFor(() => expect(latest?.jobStatus?.queue_position).toBe(2));
  });

  it("polls terminal state even when the live connection stays connected", async () => {
    vi.mocked(getJob).mockResolvedValue({
      status: "DONE",
      stage: "DONE",
      progress: 100,
      message: "done",
    });

    let latest: Snapshot | null = null;
    render(<RunnerProbe onState={(snapshot) => (latest = snapshot)} />);

    await waitFor(() => expect(capturedHandler).not.toBeNull());
    await waitFor(() => expect(getJob).toHaveBeenCalledWith("job_test"), { timeout: 3000 });
    await waitFor(() => expect(latest?.jobStatus?.status).toBe("DONE"), { timeout: 3000 });
    await waitFor(() => expect(latest?.connectionState).toBe("idle"), { timeout: 3000 });
  }, 10000);
});
