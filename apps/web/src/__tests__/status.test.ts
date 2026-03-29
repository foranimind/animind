import { describe, expect, it } from "vitest";

import {
  getWorkDetailStatusInfo,
  getWorkStatusDisplay,
  resolveJobStageLabel,
} from "../lib/status";

describe("status helpers", () => {
  describe("resolveJobStageLabel", () => {
    it("prefers stage mapping when available", () => {
      expect(resolveJobStageLabel("RUNNING_MOTION", "RUNNING")).toBe("\u52a8\u4f5c");
      expect(resolveJobStageLabel("COMPOSING_PREVIEW", "RUNNING")).toBe(
        "\u9884\u89c8\u5408\u6210"
      );
    });

    it("falls back to status mapping when stage is missing", () => {
      expect(resolveJobStageLabel(undefined, "QUEUED")).toBe("\u6392\u961f\u4e2d");
    });

    it("returns stage value when unknown", () => {
      expect(resolveJobStageLabel("CUSTOM_STAGE", "QUEUED")).toBe("CUSTOM_STAGE");
    });

    it("uses default label when empty", () => {
      expect(resolveJobStageLabel()).toBe("\u51c6\u5907\u4e2d");
    });
  });

  describe("getWorkStatusDisplay", () => {
    it("handles error and loading overrides", () => {
      const errorState = getWorkStatusDisplay({ status: "DONE", error: "boom" });
      expect(errorState.label).toBe("\u9519\u8bef");
      expect(errorState.tone).toBe("error");
      expect(errorState.hasStatus).toBe(true);

      const loadingState = getWorkStatusDisplay({ status: "DONE", loading: true });
      expect(loadingState.label).toBe("\u52a0\u8f7d\u4e2d");
      expect(loadingState.tone).toBe("loading");
      expect(loadingState.hasStatus).toBe(true);
    });

    it("maps known statuses with correct tone", () => {
      const doneState = getWorkStatusDisplay({ status: "done" });
      expect(doneState.label).toBe("\u5b8c\u6210");
      expect(doneState.tone).toBe("ready");
      expect(doneState.hasStatus).toBe(true);

      const runningScene = getWorkStatusDisplay({ status: "running_scene" });
      expect(runningScene.label).toBe("\u573a\u666f\u751f\u6210");
      expect(runningScene.tone).toBe("idle");
    });

    it("formats unknown statuses and marks visibility", () => {
      const waiting = getWorkStatusDisplay({ status: "waiting" });
      expect(waiting.label).toBe("Waiting");
      expect(waiting.tone).toBe("idle");
      expect(waiting.hasStatus).toBe(true);

      const empty = getWorkStatusDisplay({});
      expect(empty.label).toBe("\u672a\u77e5");
      expect(empty.tone).toBe("unknown");
      expect(empty.hasStatus).toBe(false);
    });
  });

  describe("getWorkDetailStatusInfo", () => {
    it("maps manifest and preview states", () => {
      expect(
        getWorkDetailStatusInfo({
          manifestStatus: "loading",
          previewStatus: "idle",
        })
      ).toEqual({ label: "加载中", tone: "loading" });

      expect(
        getWorkDetailStatusInfo({
          manifestStatus: "error",
          previewStatus: "idle",
          manifestNotFound: true,
        })
      ).toEqual({ label: "未找到", tone: "error" });

      expect(
        getWorkDetailStatusInfo({
          manifestStatus: "ready",
          previewStatus: "loading",
        })
      ).toEqual({ label: "预览加载中", tone: "loading" });

      expect(
        getWorkDetailStatusInfo({
          manifestStatus: "ready",
          previewStatus: "error",
        })
      ).toEqual({ label: "预览异常", tone: "warning" });

      expect(
        getWorkDetailStatusInfo({
          manifestStatus: "ready",
          previewStatus: "ready",
        })
      ).toEqual({ label: "就绪", tone: "ready" });

      expect(
        getWorkDetailStatusInfo({
          manifestStatus: "idle",
          previewStatus: "idle",
        })
      ).toEqual({ label: "待加载", tone: "idle" });
    });
  });
});
