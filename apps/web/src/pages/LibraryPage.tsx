import { useCallback, useMemo, useState } from "react";

import { LibraryCommandBar } from "../components/library/LibraryCommandBar";
import { LibraryFilterDrawer } from "../components/library/LibraryFilterDrawer";
import type { FilterOption } from "../components/library/LibraryFilters";
import { WorkCard } from "../components/library/WorkCard";
import { ActionButton } from "../components/ui/ActionButton";
import { PageHeader } from "../components/ui/PageHeader";
import { SurfacePanel } from "../components/ui/SurfacePanel";
import { useRecentWorks } from "../hooks/useRecentWorks";
import { useResourceMap } from "../hooks/useResourceMap";
import { fetchManifest } from "../lib/api";
import { toErrorMessage } from "../lib/errors";
import { getManifestSummary } from "../lib/manifestAssets";
import { removeWork } from "../lib/storage";
import "./pages.css";
import "./library.css";
import "../components/library/library.css";

type WorkSummary = {
  jobId: string;
  title: string;
  prompt?: string;
  style?: string;
  duration?: number;
  status?: string;
  createdAt?: string;
  thumbnailUri?: string;
  loading?: boolean;
  error?: string;
};

const durationOptions: FilterOption[] = [
  { value: "any", label: "不限时长" },
  { value: "short", label: "0-10秒" },
  { value: "medium", label: "10-30秒" },
  { value: "long", label: "30秒以上" },
];

const dateOptions: FilterOption[] = [
  { value: "any", label: "不限日期" },
  { value: "has", label: "有日期" },
  { value: "none", label: "无日期" },
];

const truncate = (value: string, max = 64) =>
  value.length > max ? `${value.slice(0, max - 1)}...` : value;

const matchesDuration = (duration: number | undefined, filter: string) => {
  if (filter === "any") {
    return true;
  }
  if (typeof duration !== "number" || !Number.isFinite(duration)) {
    return false;
  }
  switch (filter) {
    case "short":
      return duration <= 10;
    case "medium":
      return duration > 10 && duration <= 30;
    case "long":
      return duration > 30;
    default:
      return true;
  }
};

export const LibraryPage = () => {
  const { items } = useRecentWorks();
  const jobIds = useMemo(() => items.map((item) => item.jobId), [items]);
  const mapError = useCallback(
    (error: unknown) => toErrorMessage(error, "加载清单失败。"),
    []
  );
  const manifestMap = useResourceMap(jobIds, fetchManifest, { mapError });
  const [query, setQuery] = useState("");
  const [styleFilter, setStyleFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("any");
  const [dateFilter, setDateFilter] = useState("any");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const works = useMemo<WorkSummary[]>(() => {
    return items.map((item) => {
      const entry = manifestMap[item.jobId];
      const manifest = entry && entry.status === "ready" ? entry.data : undefined;
      const summary = getManifestSummary(manifest);
      const title = summary.title ? truncate(summary.title) : `作品 ${item.jobId}`;
      return {
        jobId: item.jobId,
        title,
        prompt: summary.prompt,
        style: summary.style,
        duration: summary.duration,
        status: summary.status,
        createdAt: summary.createdAt ?? item.meta.createdAt,
        thumbnailUri: summary.thumbnailUri,
        loading: entry?.status === "loading",
        error: entry?.status === "error" ? entry.error : undefined,
      };
    });
  }, [items, manifestMap]);

  const styleOptions = useMemo(() => {
    const styles = new Set<string>();
    let hasUnknown = false;
    works.forEach((work) => {
      if (work.style) {
        styles.add(work.style);
      } else {
        hasUnknown = true;
      }
    });
    const options = [{ value: "all", label: "全部风格" }];
    Array.from(styles)
      .sort((a, b) => a.localeCompare(b))
      .forEach((style) => options.push({ value: style, label: style }));
    if (hasUnknown) {
      options.push({ value: "unknown", label: "未知" });
    }
    return options;
  }, [works]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onClear: () => void }> = [];
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      chips.push({
        id: "query",
        label: `搜索：${truncate(trimmedQuery, 32)}`,
        onClear: () => setQuery(""),
      });
    }
    if (styleFilter !== "all") {
      const styleLabel =
        styleOptions.find((option) => option.value === styleFilter)?.label ?? styleFilter;
      chips.push({
        id: "style",
        label: `风格：${styleLabel}`,
        onClear: () => setStyleFilter("all"),
      });
    }
    if (durationFilter !== "any") {
      const durationLabel =
        durationOptions.find((option) => option.value === durationFilter)?.label ??
        durationFilter;
      chips.push({
        id: "duration",
        label: `时长：${durationLabel}`,
        onClear: () => setDurationFilter("any"),
      });
    }
    if (dateFilter !== "any") {
      const dateLabel =
        dateOptions.find((option) => option.value === dateFilter)?.label ?? dateFilter;
      chips.push({
        id: "date",
        label: `日期：${dateLabel}`,
        onClear: () => setDateFilter("any"),
      });
    }
    return chips;
  }, [
    dateFilter,
    durationFilter,
    query,
    setDateFilter,
    setDurationFilter,
    setQuery,
    setStyleFilter,
    styleFilter,
    styleOptions,
  ]);

  const filterCount = useMemo(() => {
    let count = 0;
    if (styleFilter !== "all") {
      count += 1;
    }
    if (durationFilter !== "any") {
      count += 1;
    }
    if (dateFilter !== "any") {
      count += 1;
    }
    return count;
  }, [dateFilter, durationFilter, styleFilter]);

  const filteredWorks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return works.filter((work) => {
      if (normalizedQuery) {
        const haystack = `${work.title} ${work.prompt ?? ""}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }
      if (styleFilter !== "all") {
        if (styleFilter === "unknown") {
          if (work.style) {
            return false;
          }
        } else if (work.style !== styleFilter) {
          return false;
        }
      }
      if (!matchesDuration(work.duration, durationFilter)) {
        return false;
      }
      if (dateFilter === "has" && !work.createdAt) {
        return false;
      }
      if (dateFilter === "none" && work.createdAt) {
        return false;
      }
      return true;
    });
  }, [works, query, styleFilter, durationFilter, dateFilter]);

  return (
    <div className="page library-page">
      <PageHeader
        eyebrow="Archive Gallery"
        title="我的作品"
        description="在这里查看最近保存的作品、封面与归档结果。"
        accessory={<div className="library-count">共 {filteredWorks.length} 件作品</div>}
        className="library-header"
      />
      <LibraryCommandBar
        query={query}
        filterCount={filterCount}
        chips={activeFilterChips}
        isFiltersOpen={filtersOpen}
        onQueryChange={setQuery}
        onOpenFilters={() => setFiltersOpen(true)}
      />
      {filteredWorks.length === 0 ? (
        <SurfacePanel
          tone="muted"
          className="library-empty"
          bodyClassName="library-empty-body"
          header={
            <div className="library-empty-header">
              <div className="library-empty-title">这里还没有作品归档</div>
              <div className="library-empty-subtitle">
                第一条生成完成后，它会带着封面和基础信息出现在这里。现在可以先去发起新的创作。
              </div>
            </div>
          }
        >
          <div className="library-empty-actions">
            <ActionButton href="/" className="library-empty-action">
              <span className="library-empty-action-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20">
                  <path
                    d="M4.5 10h10M11 6.5 14.5 10 11 13.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>开始创作</span>
            </ActionButton>
          </div>
        </SurfacePanel>
      ) : (
        <div className="library-grid" aria-label="作品归档画廊">
          {filteredWorks.map((work) => (
            <WorkCard
              key={work.jobId}
              jobId={work.jobId}
              title={work.title}
              thumbnailUri={work.thumbnailUri}
              style={work.style}
              duration={work.duration}
              status={work.status}
              createdAt={work.createdAt}
              loading={work.loading}
              error={work.error}
              onRemove={removeWork}
            />
          ))}
        </div>
      )}
      <LibraryFilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        style={styleFilter}
        duration={durationFilter}
        date={dateFilter}
        styleOptions={styleOptions}
        durationOptions={durationOptions}
        dateOptions={dateOptions}
        onStyleChange={setStyleFilter}
        onDurationChange={setDurationFilter}
        onDateChange={setDateFilter}
        onClear={() => {
          setStyleFilter("all");
          setDurationFilter("any");
          setDateFilter("any");
        }}
      />
    </div>
  );
};
