# Frontend Workflow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `apps/web` around a route-centered create -> run -> deliver workflow so prompt input stays primary on the create page, active jobs live on a dedicated run page, and completed output is delivered on a dedicated delivery page.

**Architecture:** Keep the existing app shell, preview stack, session persistence, and job transport layers, but split page ownership by route instead of rendering create, running, and delivery modes inside `CreatePage`. Add route-resolution helpers, recovery metadata, and purpose-built page components so navigation, refresh, cancel, failure, and completion all land on the correct page.

**Tech Stack:** React 19, React Router 6, TypeScript, Vite, Vitest, Testing Library, Zod, localStorage-backed session store, existing `/api/jobs` + `/assets` frontend API layer.

---

## File Structure

### Shared Session and Routing Contract

- Modify: `apps/web/src/lib/storage.ts`
  - Add persisted recovery metadata to `SessionDetail`.
  - Keep existing session index logic, but stop treating create-page-local UI mode as lifecycle source of truth.
- Modify: `apps/web/src/lib/sessionDefaults.ts`
  - Seed new sessions with route-neutral defaults.
- Create: `apps/web/src/lib/sessionRouting.ts`
  - Resolve session status into the correct route path (`/`, `/jobs/:id`, `/works/:id`).

### Route and Page Composition

- Modify: `apps/web/src/App.tsx`
  - Add the run route and a root route that restores to the correct page.
- Create: `apps/web/src/pages/HomeRoute.tsx`
  - Redirect root visits based on the active session state.
- Modify: `apps/web/src/components/sidebar/AppSidebar.tsx`
  - Open sessions on the route implied by their state instead of always navigating to `/`.
- Modify: `apps/web/src/pages/CreatePage.tsx`
  - Strip out running and delivery ownership.
- Create: `apps/web/src/pages/JobRunPage.tsx`
  - Own active-job monitoring, preview, cancel, and terminal transitions.
- Create: `apps/web/src/pages/DeliveryPage.tsx`
  - Own delivery preview, assets, export, and partial-preview fallbacks.
- Modify: `apps/web/src/pages/DetailPage.tsx`
  - Delegate to `DeliveryPage`.

### Create Page Components

- Create: `apps/web/src/components/create/PromptComposer.tsx`
- Create: `apps/web/src/components/create/PromptHelperBar.tsx`
- Create: `apps/web/src/components/create/CreateSettingsPanel.tsx`
- Create: `apps/web/src/components/create/RecoveredContextPanel.tsx`

### Run Page Components

- Create: `apps/web/src/components/run/RunTimelinePanel.tsx`
- Create: `apps/web/src/components/run/RunLogPanel.tsx`
- Create: `apps/web/src/components/run/RunActionBar.tsx`
- Create: `apps/web/src/components/run/RunPreviewPane.tsx`

### Delivery Page Components

- Create: `apps/web/src/components/delivery/DeliveryHeroPreview.tsx`
- Create: `apps/web/src/components/delivery/DeliveryAssetsPanel.tsx`
- Create: `apps/web/src/components/delivery/DeliveryExportPanel.tsx`

### Styling

- Modify: `apps/web/src/pages/pages.css`
  - Rework create-page layout and add job-run-page layout styles.
- Modify: `apps/web/src/pages/workDetail.css`
  - Reuse as the delivery-page stylesheet until a later rename is justified.

### Tests

- Create: `apps/web/src/__tests__/sessionRouting.test.ts`
- Create: `apps/web/src/__tests__/AppRoutes.test.tsx`
- Create: `apps/web/src/__tests__/CreatePageRecovery.test.tsx`
- Create: `apps/web/src/__tests__/JobRunPage.test.tsx`
- Create: `apps/web/src/__tests__/DeliveryPage.test.tsx`
- Modify: `apps/web/src/__tests__/AppSidebar.test.tsx`
- Delete: `apps/web/src/__tests__/InspectorProgressPanel.test.tsx`

### Repo Hygiene

- Modify: `.gitignore`
  - Ignore `.superpowers/`.
- Delete when unused:
  - `apps/web/src/components/inspector/InspectorOptionsPanel.tsx`
  - `apps/web/src/components/inspector/InspectorProgressPanel.tsx`
  - `apps/web/src/components/inspector/InspectorResultsPanel.tsx`
  - `apps/web/src/components/chat/CreateChatPanel.tsx`
  - `apps/web/src/pages/WorkDetailPage.tsx`

### Worktree Requirement

- Before executing this plan, create an isolated worktree and run the baseline `apps/web` tests there.
- Use `superpowers:using-git-worktrees` before implementation, not during this planning phase.

### Task 1: Add Session Routing and Recovery Metadata

**Files:**
- Create: `apps/web/src/lib/sessionRouting.ts`
- Modify: `apps/web/src/lib/storage.ts`
- Modify: `apps/web/src/lib/sessionDefaults.ts`
- Test: `apps/web/src/__tests__/sessionRouting.test.ts`

- [ ] **Step 1: Write the failing tests for route resolution and recovery persistence**

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { getSessionDetail, saveSessionDetail } from "../lib/storage";
import { resolveSessionHref } from "../lib/sessionRouting";

describe("sessionRouting", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("routes draft sessions to create, running sessions to run, and done sessions to delivery", () => {
    expect(resolveSessionHref({ status: "draft" })).toBe("/");
    expect(resolveSessionHref({ status: "running", jobId: "job_live" })).toBe("/jobs/job_live");
    expect(resolveSessionHref({ status: "done", jobId: "job_done" })).toBe("/works/job_done");
  });

  it("round-trips persisted recovery metadata", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess_error", now);
    detail.status = "error";
    detail.jobId = "job_error";
    detail.recovery = {
      reason: "error",
      message: "music worker crashed",
      stage: "RUNNING_MUSIC",
      updatedAt: now,
    };

    saveSessionDetail(detail);

    expect(getSessionDetail(detail.id)?.recovery).toEqual({
      reason: "error",
      message: "music worker crashed",
      stage: "RUNNING_MUSIC",
      updatedAt: now,
    });
  });
});
```

- [ ] **Step 2: Run the focused test file and confirm it fails because the helper and recovery field do not exist yet**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/sessionRouting.test.ts
```

Expected: FAIL with module/type errors such as `Cannot find module '../lib/sessionRouting'` and `Property 'recovery' does not exist on type 'SessionDetail'`.

- [ ] **Step 3: Implement route resolution and recovery persistence**

```ts
// apps/web/src/lib/sessionRouting.ts
import type { SessionStatus } from "./storage";

type SessionRouteInput = {
  status: SessionStatus;
  jobId?: string;
};

export const resolveSessionHref = ({ status, jobId }: SessionRouteInput): string => {
  if (status === "done" && jobId) {
    return `/works/${encodeURIComponent(jobId)}`;
  }

  if ((status === "queued" || status === "running") && jobId) {
    return `/jobs/${encodeURIComponent(jobId)}`;
  }

  return "/";
};
```

```ts
// apps/web/src/lib/storage.ts
export type SessionRecovery = {
  reason: "error" | "canceled";
  message?: string;
  stage?: string;
  updatedAt: string;
};

const isSessionRecovery = (value: unknown): value is SessionRecovery => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    (record.reason === "error" || record.reason === "canceled") &&
    typeof record.updatedAt === "string" &&
    (record.message === undefined || typeof record.message === "string") &&
    (record.stage === undefined || typeof record.stage === "string")
  );
};

export type SessionDetail = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  jobId?: string;
  lastPrompt?: string;
  messages: SessionMessage[];
  draft: string;
  options: SessionOptions;
  ui: SessionUiState;
  recovery?: SessionRecovery;
};

// inside safeParseSessionDetail()
return {
  id: record.id,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  status: record.status,
  jobId: typeof record.jobId === "string" ? record.jobId : undefined,
  lastPrompt: typeof record.lastPrompt === "string" ? record.lastPrompt : undefined,
  messages,
  draft: record.draft,
  options: record.options,
  ui: record.ui,
  recovery: isSessionRecovery(record.recovery) ? record.recovery : undefined,
};
```

```ts
// apps/web/src/lib/sessionDefaults.ts
export const buildDefaultSessionDetail = (sessionId: string, createdAt: string): SessionDetail => ({
  id: sessionId,
  createdAt,
  updatedAt: createdAt,
  status: "draft",
  messages: INITIAL_MESSAGES,
  draft: "",
  options: {
    style: STYLE_OPTIONS[0].id,
    mood: MOOD_OPTIONS[0].id,
    duration: DEFAULT_DURATION,
    advancedSettings: DEFAULT_ADVANCED_SETTINGS,
    exportPreset: DEFAULT_EXPORT_PRESET,
  },
  ui: {
    inspectorStage: DEFAULT_INSPECTOR_STAGE,
    activeTab: DEFAULT_ACTIVE_TAB,
  },
  recovery: undefined,
});
```

- [ ] **Step 4: Re-run the focused tests and confirm they pass**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/sessionRouting.test.ts
```

Expected: PASS with 2 passing tests and 0 failures.

- [ ] **Step 5: Commit the route contract and recovery model**

```powershell
Set-Location ..
git add apps/web/src/lib/sessionRouting.ts apps/web/src/lib/storage.ts apps/web/src/lib/sessionDefaults.ts apps/web/src/__tests__/sessionRouting.test.ts
git commit -m "feat: add session routing and recovery metadata"
```

### Task 2: Restore the Correct Route on Root Load and Sidebar Open

**Files:**
- Create: `apps/web/src/pages/HomeRoute.tsx`
- Create: `apps/web/src/pages/JobRunPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/sidebar/AppSidebar.tsx`
- Modify: `apps/web/src/__tests__/AppSidebar.test.tsx`
- Test: `apps/web/src/__tests__/AppRoutes.test.tsx`

- [ ] **Step 1: Write failing tests for root restoration and sidebar navigation**

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";

import { App } from "../App";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { saveSessionDetail, setActiveSessionId } from "../lib/storage";

describe("App routes", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restores running sessions into the run route when the user lands on root", async () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess_running", now);
    detail.status = "running";
    detail.jobId = "job_live";
    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("任务进行中")).toBeInTheDocument();
    expect(screen.getByText("job_live")).toBeInTheDocument();
  });
});
```

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AppSidebar } from "../components/sidebar/AppSidebar";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { saveSessionDetail, setActiveSessionId } from "../lib/storage";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

describe("AppSidebar routing", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    localStorage.clear();
  });

  it("opens running sessions on the job route instead of root", async () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess_running", now);
    detail.status = "running";
    detail.jobId = "job_live";
    detail.lastPrompt = "Running scene";
    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    screen.getByRole("button", { name: "Running scene" }).click();

    expect(navigateSpy).toHaveBeenCalledWith("/jobs/job_live");
  });
});
```

- [ ] **Step 2: Run the route and sidebar tests and confirm they fail**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/AppRoutes.test.tsx src/__tests__/AppSidebar.test.tsx
```

Expected: FAIL because the app has no `/jobs/:id` route and sidebar selection still always navigates to `/`.

- [ ] **Step 3: Implement root restoration, the run route stub, and sidebar route-aware navigation**

```tsx
// apps/web/src/pages/HomeRoute.tsx
import { Navigate } from "react-router-dom";

import { getActiveSessionId, getSessionDetail } from "../lib/storage";
import { resolveSessionHref } from "../lib/sessionRouting";
import { CreatePage } from "./CreatePage";

export const HomeRoute = () => {
  const activeSessionId = getActiveSessionId();
  const detail = activeSessionId ? getSessionDetail(activeSessionId) : null;
  const href = detail
    ? resolveSessionHref({ status: detail.status, jobId: detail.jobId })
    : "/";

  return href === "/" ? <CreatePage /> : <Navigate to={href} replace />;
};
```

```tsx
// apps/web/src/pages/JobRunPage.tsx
import { useParams } from "react-router-dom";

export const JobRunPage = () => {
  const { id } = useParams();

  return (
    <div className="page job-run-page">
      <h1 className="page-title">任务进行中</h1>
      <p>{id}</p>
    </div>
  );
};
```

```tsx
// apps/web/src/App.tsx
import { Route, Routes, useParams } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout";
import { HomeRoute } from "./pages/HomeRoute";
import { JobRunPage } from "./pages/JobRunPage";
import { DetailPage } from "./pages/DetailPage";
import { LibraryPage } from "./pages/LibraryPage";

const WorkDetailRoute = () => {
  const { id } = useParams();
  return <DetailPage jobId={id} />;
};

const JobRunRoute = () => {
  const { id } = useParams();
  return <JobRunPage key={id} />;
};

export const App = () => (
  <Routes>
    <Route element={<AppLayout />}>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/jobs/:id" element={<JobRunRoute />} />
      <Route path="/works" element={<LibraryPage />} />
      <Route path="/works/:id" element={<WorkDetailRoute />} />
      <Route path="*" element={<HomeRoute />} />
    </Route>
  </Routes>
);
```

```tsx
// apps/web/src/components/sidebar/AppSidebar.tsx
import { resolveSessionHref } from "../../lib/sessionRouting";

const handleSessionSelect = (sessionId: string) => {
  const session = items.find((entry) => entry.id === sessionId);
  if (!session) {
    return;
  }
  touchSession(sessionId);
  setActiveSessionId(sessionId);
  navigate(resolveSessionHref({ status: session.status, jobId: session.jobId }));
};
```

- [ ] **Step 4: Re-run the tests and confirm route restoration now passes**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/AppRoutes.test.tsx src/__tests__/AppSidebar.test.tsx
```

Expected: PASS with the new route test and updated sidebar test both green.

- [ ] **Step 5: Commit the route restoration behavior**

```powershell
Set-Location ..
git add apps/web/src/pages/HomeRoute.tsx apps/web/src/pages/JobRunPage.tsx apps/web/src/App.tsx apps/web/src/components/sidebar/AppSidebar.tsx apps/web/src/__tests__/AppRoutes.test.tsx apps/web/src/__tests__/AppSidebar.test.tsx
git commit -m "feat: restore sessions to the correct route"
```

### Task 3: Refactor the Create Page Around Prompt Composition and Recovery

**Files:**
- Create: `apps/web/src/components/create/PromptComposer.tsx`
- Create: `apps/web/src/components/create/PromptHelperBar.tsx`
- Create: `apps/web/src/components/create/CreateSettingsPanel.tsx`
- Create: `apps/web/src/components/create/RecoveredContextPanel.tsx`
- Modify: `apps/web/src/pages/CreatePage.tsx`
- Modify: `apps/web/src/pages/pages.css`
- Test: `apps/web/src/__tests__/CreatePageRecovery.test.tsx`

- [ ] **Step 1: Write failing tests for prompt-led submission and recovery rendering**

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { CreatePage } from "../pages/CreatePage";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { saveSessionDetail, setActiveSessionId } from "../lib/storage";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock("../lib/api", () => ({
  createJob: vi.fn(() => Promise.resolve({ job_id: "job_live" })),
}));

describe("CreatePage recovery", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    localStorage.clear();
  });

  it("shows a recovery banner and restored draft after cancellation", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess_cancel", now);
    detail.status = "canceled";
    detail.draft = "sunset skyline with slow orbit camera";
    detail.lastPrompt = detail.draft;
    detail.messages.push({ id: "user-1", role: "user", content: detail.draft });
    detail.recovery = {
      reason: "canceled",
      message: "用户取消",
      stage: "RUNNING_SCENE",
      updatedAt: now,
    };
    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    expect(screen.getByText("任务已取消")).toBeInTheDocument();
    expect(screen.getByDisplayValue("sunset skyline with slow orbit camera")).toBeInTheDocument();
  });

  it("creates a job from the prompt composer and navigates to the run page", async () => {
    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText("描述你的场景、光线、动作与配乐..."), "rainy alley with synthwave music");
    await userEvent.click(screen.getByRole("button", { name: "开始生成" }));

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/jobs/job_live"));
  });
});
```

- [ ] **Step 2: Run the create-page tests and confirm they fail**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/CreatePageRecovery.test.tsx
```

Expected: FAIL because the current page still renders the old chat/inspector lifecycle and does not navigate directly to `/jobs/:id`.

- [ ] **Step 3: Implement prompt-first create components and direct job launch**

```tsx
// apps/web/src/components/create/PromptComposer.tsx
type PromptComposerProps = {
  draft: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
};

export const PromptComposer = ({
  draft,
  canSubmit,
  isSubmitting,
  onDraftChange,
  onSubmit,
}: PromptComposerProps) => (
  <section className="prompt-composer-card">
    <label className="prompt-composer-label" htmlFor="prompt-composer">
      创作描述
    </label>
    <textarea
      id="prompt-composer"
      value={draft}
      rows={6}
      placeholder="描述你的场景、光线、动作与配乐..."
      onChange={(event) => onDraftChange(event.target.value)}
    />
    <button type="button" className="primary-button" disabled={!canSubmit || isSubmitting} onClick={onSubmit}>
      <span>{isSubmitting ? "创建中..." : "开始生成"}</span>
    </button>
  </section>
);
```

```tsx
// apps/web/src/components/create/RecoveredContextPanel.tsx
import type { SessionMessage, SessionRecovery } from "../../lib/storage";

type RecoveredContextPanelProps = {
  recovery?: SessionRecovery;
  messages: SessionMessage[];
};

export const RecoveredContextPanel = ({ recovery, messages }: RecoveredContextPanelProps) => {
  const compactHistory = messages.filter((item) => item.role !== "tool").slice(-4);

  return (
    <section className="recovered-context-card">
      {recovery ? (
        <div className={`recovery-banner ${recovery.reason}`}>
          <strong>{recovery.reason === "canceled" ? "任务已取消" : "生成失败"}</strong>
          <span>{recovery.message ?? "请调整输入后重试。"}</span>
        </div>
      ) : null}
      {compactHistory.length > 0 ? (
        <ul className="compact-history-list">
          {compactHistory.map((item) => (
            <li key={item.id}>{item.content}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
```

```tsx
// apps/web/src/pages/CreatePage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { PromptComposer } from "../components/create/PromptComposer";
import { PromptHelperBar } from "../components/create/PromptHelperBar";
import { CreateSettingsPanel } from "../components/create/CreateSettingsPanel";
import { RecoveredContextPanel } from "../components/create/RecoveredContextPanel";
import { createJob } from "../lib/api";
import { buildDefaultSessionDetail, createSessionId } from "../lib/sessionDefaults";
import { getActiveSessionId, getSessionDetail, saveSessionDetail, setActiveSessionId } from "../lib/storage";

export const CreatePage = () => {
  const navigate = useNavigate();
  const activeSessionId = getActiveSessionId();
  const activeDetail = activeSessionId ? getSessionDetail(activeSessionId) : null;
  const base = activeDetail ?? buildDefaultSessionDetail(createSessionId(), new Date().toISOString());
  const [draft, setDraft] = useState(base.draft || base.lastPrompt || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = draft.trim().length > 0;

  const handleSubmit = async () => {
    const prompt = draft.trim();
    if (!prompt || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const sessionId = activeDetail?.id ?? base.id;
      const now = new Date().toISOString();
      const response = await createJob(prompt, {
        style: base.options.style,
        mood: base.options.mood,
        duration_s: base.options.duration,
        export_video: true,
        export_preset: base.options.exportPreset,
        advanced: {
          model: base.options.advancedSettings.model,
        },
      });

      saveSessionDetail(
        {
          ...base,
          id: sessionId,
          updatedAt: now,
          status: "queued",
          jobId: response.job_id,
          lastPrompt: prompt,
          draft: prompt,
          recovery: undefined,
        },
        { status: "queued", jobId: response.job_id, lastOpenedAt: now }
      );
      setActiveSessionId(sessionId);
      navigate(`/jobs/${response.job_id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page create-page">
      <div className="create-launch-shell">
        <RecoveredContextPanel recovery={base.recovery} messages={base.messages} />
        <PromptComposer
          draft={draft}
          canSubmit={canSubmit}
          isSubmitting={isSubmitting}
          onDraftChange={setDraft}
          onSubmit={handleSubmit}
        />
        <PromptHelperBar onInsert={(value) => setDraft((prev) => (prev ? `${prev}\n${value}` : value))} />
        <CreateSettingsPanel detail={base} />
      </div>
    </div>
  );
};
```

```css
/* apps/web/src/pages/pages.css */
.create-launch-shell {
  width: min(100%, 1100px);
  margin: 0 auto;
  display: grid;
  gap: 18px;
  padding: 32px 24px 48px;
}

.prompt-composer-card,
.recovered-context-card,
.create-settings-card {
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow);
  padding: 20px;
}

.compact-history-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
```

- [ ] **Step 4: Re-run the create-page tests and confirm they pass**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/CreatePageRecovery.test.tsx
```

Expected: PASS with restored recovery rendering and direct navigation to `/jobs/job_live`.

- [ ] **Step 5: Commit the prompt-first create page**

```powershell
Set-Location ..
git add apps/web/src/components/create/PromptComposer.tsx apps/web/src/components/create/PromptHelperBar.tsx apps/web/src/components/create/CreateSettingsPanel.tsx apps/web/src/components/create/RecoveredContextPanel.tsx apps/web/src/pages/CreatePage.tsx apps/web/src/pages/pages.css apps/web/src/__tests__/CreatePageRecovery.test.tsx
git commit -m "feat: refactor create page around prompt composition"
```

### Task 4: Implement the Dedicated Run Page and Terminal Transitions

**Files:**
- Modify: `apps/web/src/pages/JobRunPage.tsx`
- Create: `apps/web/src/components/run/RunTimelinePanel.tsx`
- Create: `apps/web/src/components/run/RunLogPanel.tsx`
- Create: `apps/web/src/components/run/RunActionBar.tsx`
- Create: `apps/web/src/components/run/RunPreviewPane.tsx`
- Modify: `apps/web/src/pages/pages.css`
- Test: `apps/web/src/__tests__/JobRunPage.test.tsx`

- [ ] **Step 1: Write failing tests for success navigation and cancel/failure recovery**

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { JobRunPage } from "../pages/JobRunPage";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { saveSessionDetail, setActiveSessionId } from "../lib/storage";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy, useParams: () => ({ id: "job_live" }) };
});

vi.mock("../hooks/useJobRunner", () => ({
  useJobRunner: () => ({
    jobId: "job_live",
    jobStatus: { status: "DONE", stage: "DONE", progress: 100, logs_tail: ["done"] },
    error: null,
    isStarting: false,
    connectionState: "connected",
    start: vi.fn(),
    subscribeExistingJob: vi.fn(),
    reset: vi.fn(),
    stop: vi.fn(),
  }),
}));

describe("JobRunPage", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    localStorage.clear();
  });

  it("routes successful jobs to the delivery page", async () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess_done", now);
    detail.status = "running";
    detail.jobId = "job_live";
    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <JobRunPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/works/job_live", { replace: true }));
  });
});
```

- [ ] **Step 2: Run the run-page test and confirm it fails**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/JobRunPage.test.tsx
```

Expected: FAIL because `JobRunPage` is still a placeholder and does not subscribe, render run modules, or navigate on terminal states.

- [ ] **Step 3: Build the run page and move active-job behavior into it**

```tsx
// apps/web/src/pages/JobRunPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { cancelJob } from "../lib/api";
import { listSessions, getSessionDetail, saveSessionDetail, setActiveSessionId, updateSessionIndex } from "../lib/storage";
import { resolveJobStageLabel } from "../lib/status";
import { useJobRunner } from "../hooks/useJobRunner";
import { RunTimelinePanel } from "../components/run/RunTimelinePanel";
import { RunLogPanel } from "../components/run/RunLogPanel";
import { RunActionBar } from "../components/run/RunActionBar";
import { RunPreviewPane } from "../components/run/RunPreviewPane";

const TERMINAL_DONE = new Set(["DONE", "COMPLETED"]);
const TERMINAL_ERROR = new Set(["FAILED", "ERROR"]);
const TERMINAL_CANCELED = new Set(["CANCELED", "CANCELLED"]);

export const JobRunPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isCanceling, setIsCanceling] = useState(false);
  const { jobStatus, error, subscribeExistingJob } = useJobRunner("", {});

  useEffect(() => {
    if (id) {
      subscribeExistingJob(id).catch(() => null);
    }
  }, [id, subscribeExistingJob]);

  const sessionId = useMemo(() => {
    return listSessions().find((item) => item.jobId === id)?.id ?? null;
  }, [id]);

  useEffect(() => {
    const status = jobStatus?.status?.toUpperCase();
    if (!id || !status || !sessionId) {
      return;
    }

    const detail = getSessionDetail(sessionId);
    if (!detail) {
      return;
    }

    if (TERMINAL_DONE.has(status)) {
      updateSessionIndex(sessionId, { status: "done", jobId: id });
      setActiveSessionId(sessionId);
      navigate(`/works/${id}`, { replace: true });
      return;
    }

    if (TERMINAL_ERROR.has(status) || TERMINAL_CANCELED.has(status)) {
      const reason = TERMINAL_CANCELED.has(status) ? "canceled" : "error";
      const now = new Date().toISOString();
      saveSessionDetail(
        {
          ...detail,
          updatedAt: now,
          status: reason,
          recovery: {
            reason: reason === "canceled" ? "canceled" : "error",
            message: error ?? jobStatus?.message,
            stage: resolveJobStageLabel(jobStatus?.stage, jobStatus?.status),
            updatedAt: now,
          },
        },
        { status: reason, updatedAt: now }
      );
      setActiveSessionId(sessionId);
      navigate("/", { replace: true });
    }
  }, [error, id, jobStatus, navigate, sessionId]);

  const handleCancel = async () => {
    if (!id || isCanceling) {
      return;
    }
    setIsCanceling(true);
    try {
      await cancelJob(id, "用户取消");
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="page job-run-page">
      <div className="job-run-shell">
        <div className="job-run-process-column">
          <RunTimelinePanel status={jobStatus} />
          <RunLogPanel lines={jobStatus?.logs_tail ?? []} />
          <RunActionBar canCancel onCancel={handleCancel} isCanceling={isCanceling} />
        </div>
        <div className="job-run-preview-column">
          <RunPreviewPane jobId={id} status={jobStatus} />
        </div>
      </div>
    </div>
  );
};
```

```tsx
// apps/web/src/components/run/RunActionBar.tsx
type RunActionBarProps = {
  canCancel: boolean;
  isCanceling: boolean;
  onCancel: () => void;
};

export const RunActionBar = ({ canCancel, isCanceling, onCancel }: RunActionBarProps) => (
  <div className="run-action-bar">
    <button type="button" className="ghost-button danger" disabled={!canCancel || isCanceling} onClick={onCancel}>
      {isCanceling ? "取消中..." : "取消生成"}
    </button>
  </div>
);
```

```css
/* apps/web/src/pages/pages.css */
.job-run-shell {
  width: min(100%, 1280px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
  gap: 24px;
  padding: 32px 24px 48px;
}

.job-run-process-column,
.job-run-preview-column {
  display: grid;
  gap: 16px;
}
```

- [ ] **Step 4: Re-run the run-page tests and confirm they pass**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/JobRunPage.test.tsx
```

Expected: PASS with the route transition test green.

- [ ] **Step 5: Commit the dedicated run page**

```powershell
Set-Location ..
git add apps/web/src/pages/JobRunPage.tsx apps/web/src/components/run/RunTimelinePanel.tsx apps/web/src/components/run/RunLogPanel.tsx apps/web/src/components/run/RunActionBar.tsx apps/web/src/components/run/RunPreviewPane.tsx apps/web/src/pages/pages.css apps/web/src/__tests__/JobRunPage.test.tsx
git commit -m "feat: add dedicated run page workflow"
```

### Task 5: Refactor Delivery Into a Dedicated Result Page

**Files:**
- Create: `apps/web/src/components/delivery/DeliveryHeroPreview.tsx`
- Create: `apps/web/src/components/delivery/DeliveryAssetsPanel.tsx`
- Create: `apps/web/src/components/delivery/DeliveryExportPanel.tsx`
- Create: `apps/web/src/pages/DeliveryPage.tsx`
- Modify: `apps/web/src/pages/DetailPage.tsx`
- Modify: `apps/web/src/pages/workDetail.css`
- Test: `apps/web/src/__tests__/DeliveryPage.test.tsx`

- [ ] **Step 1: Write the failing test for partial-preview success handling**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { DeliveryPage } from "../pages/DeliveryPage";

vi.mock("../hooks/useWorkDetail", () => ({
  useWorkDetail: () => ({
    manifest: {
      status: "ready",
      notFound: false,
      data: {
        title: "Demo delivery",
        assets: {
          export_mp4: "exports/demo.mp4",
          export_zip: "exports/demo.zip",
        },
      },
    },
    preview: {
      status: "error",
      notFound: true,
      error: "preview missing",
      data: null,
    },
    reload: vi.fn(),
  }),
}));

describe("DeliveryPage", () => {
  it("keeps delivery assets visible even when preview config is missing", () => {
    render(<DeliveryPage jobId="job_done" />);

    expect(screen.getByText("后端尚未生成 preview_config")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "导出视频" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the delivery-page test and confirm it fails**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/DeliveryPage.test.tsx
```

Expected: FAIL because there is no dedicated `DeliveryPage` and no route-level delivery composition yet.

- [ ] **Step 3: Build the dedicated delivery page and move result ownership into it**

```tsx
// apps/web/src/pages/DeliveryPage.tsx
import { DeliveryAssetsPanel } from "../components/delivery/DeliveryAssetsPanel";
import { DeliveryExportPanel } from "../components/delivery/DeliveryExportPanel";
import { DeliveryHeroPreview } from "../components/delivery/DeliveryHeroPreview";
import { useWorkDetail } from "../hooks/useWorkDetail";
import { getWorkDetailStatusInfo } from "../lib/status";

type DeliveryPageProps = {
  jobId?: string;
};

export const DeliveryPage = ({ jobId }: DeliveryPageProps) => {
  const { manifest, preview, reload } = useWorkDetail(jobId?.trim());
  const statusInfo = getWorkDetailStatusInfo({
    manifestStatus: manifest.status,
    previewStatus: preview.status,
    manifestNotFound: manifest.notFound,
  });

  return (
    <div className="page work-detail-page">
      <header className="page-header work-detail-header">
        <h1 className="page-title">交付结果</h1>
        <span className={`work-detail-status ${statusInfo.tone}`}>{statusInfo.label}</span>
      </header>
      <div className="delivery-shell">
        <DeliveryHeroPreview preview={preview} onRetry={reload} />
        <div className="delivery-side-column">
          <DeliveryAssetsPanel manifest={manifest} preview={preview} />
          <DeliveryExportPanel manifest={manifest} />
        </div>
      </div>
    </div>
  );
};
```

```tsx
// apps/web/src/pages/DetailPage.tsx
import { DeliveryPage } from "./DeliveryPage";

type DetailPageProps = {
  jobId?: string;
};

export const DetailPage = ({ jobId }: DetailPageProps) => <DeliveryPage jobId={jobId} />;
```

```tsx
// apps/web/src/components/delivery/DeliveryExportPanel.tsx
type DeliveryExportPanelProps = {
  manifest: { status: "idle" | "loading" | "ready" | "error"; data?: unknown };
};

export const DeliveryExportPanel = ({ manifest }: DeliveryExportPanelProps) => {
  const exportHref =
    manifest.status === "ready" &&
    typeof (manifest.data as { assets?: { export_mp4?: string } })?.assets?.export_mp4 === "string"
      ? (manifest.data as { assets: { export_mp4: string } }).assets.export_mp4
      : undefined;

  return (
    <section className="delivery-panel">
      {exportHref ? (
        <a className="primary-button export-button" href={exportHref} download>
          导出视频
        </a>
      ) : (
        <button type="button" className="primary-button export-button" disabled>
          导出视频
        </button>
      )}
    </section>
  );
};
```

```css
/* apps/web/src/pages/workDetail.css */
.delivery-shell {
  width: min(100%, 1280px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  gap: 24px;
}

.delivery-side-column {
  display: grid;
  gap: 16px;
}
```

- [ ] **Step 4: Re-run the delivery-page test and confirm it passes**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/DeliveryPage.test.tsx
```

Expected: PASS with the partial-preview fallback and delivery asset availability contract green.

- [ ] **Step 5: Commit the delivery page refactor**

```powershell
Set-Location ..
git add apps/web/src/components/delivery/DeliveryHeroPreview.tsx apps/web/src/components/delivery/DeliveryAssetsPanel.tsx apps/web/src/components/delivery/DeliveryExportPanel.tsx apps/web/src/pages/DeliveryPage.tsx apps/web/src/pages/DetailPage.tsx apps/web/src/pages/workDetail.css apps/web/src/__tests__/DeliveryPage.test.tsx
git commit -m "feat: split delivery into a dedicated result page"
```

### Task 6: Remove Obsolete Inspector-First Artifacts and Verify the Full Workflow

**Files:**
- Delete: `apps/web/src/components/inspector/InspectorOptionsPanel.tsx`
- Delete: `apps/web/src/components/inspector/InspectorProgressPanel.tsx`
- Delete: `apps/web/src/components/inspector/InspectorResultsPanel.tsx`
- Delete: `apps/web/src/components/chat/CreateChatPanel.tsx`
- Delete: `apps/web/src/pages/WorkDetailPage.tsx`
- Delete: `apps/web/src/__tests__/InspectorProgressPanel.test.tsx`
- Modify: `.gitignore`
- Modify: `apps/web/src/__tests__/AppRoutes.test.tsx`

- [ ] **Step 1: Write the failing regression test that guards against returning to the old mixed-mode create page**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { CreatePage } from "../pages/CreatePage";

describe("CreatePage route contract", () => {
  it("does not render running or delivery controls on the create route", () => {
    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>
    );

    expect(screen.queryByText("生成进度")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消生成" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导出视频" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the regression test and confirm it fails until the last old inspector references are gone**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/AppRoutes.test.tsx
```

Expected: FAIL if the old mixed-mode components or tests are still wired into the create route.

- [ ] **Step 3: Remove obsolete inspector-first files and ignore `.superpowers/`**

```gitignore
# repo-local brainstorming artifacts
.superpowers/
```

```powershell
Set-Location ..
git rm apps/web/src/components/inspector/InspectorOptionsPanel.tsx
git rm apps/web/src/components/inspector/InspectorProgressPanel.tsx
git rm apps/web/src/components/inspector/InspectorResultsPanel.tsx
git rm apps/web/src/components/chat/CreateChatPanel.tsx
git rm apps/web/src/pages/WorkDetailPage.tsx
git rm apps/web/src/__tests__/InspectorProgressPanel.test.tsx
```

- [ ] **Step 4: Re-run focused regression tests and confirm the route split is stable**

```powershell
Set-Location apps/web
npx vitest run src/__tests__/AppRoutes.test.tsx src/__tests__/CreatePageRecovery.test.tsx src/__tests__/JobRunPage.test.tsx src/__tests__/DeliveryPage.test.tsx
```

Expected: PASS with no create-route access to run/delivery-only controls.

- [ ] **Step 5: Run full verification before the final commit**

```powershell
Set-Location apps/web
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected:
- `npm run lint` -> exit code 0
- `npm run typecheck` -> exit code 0
- `npm run test` -> all test files pass
- `npm run build` -> Vite build completes successfully

- [ ] **Step 6: Commit the cleanup and verified workflow split**

```powershell
Set-Location ..
git add .gitignore apps/web/src/__tests__/AppRoutes.test.tsx
git commit -m "refactor: remove inspector-first workflow remnants"
```

## Self-Review

### Spec Coverage Check

The plan covers each spec requirement:
1. Prompt-led create page: Task 3.
2. Dedicated run route and route restoration: Tasks 2 and 4.
3. Dedicated delivery route and partial-preview fallback: Task 5.
4. Failure/cancel recovery back to create with preserved context: Tasks 1, 3, and 4.
5. Sidebar and refresh/reopen route correctness: Task 2.
6. Duplicate-info removal and route-level ownership cleanup: Tasks 3, 4, 5, and 6.
7. Testing constraints and repo hygiene: Task 6.

### Placeholder Scan

The plan intentionally avoids `TBD`, `TODO`, “implement later”, and implicit “handle edge cases” instructions. Each task has:
1. Exact file paths.
2. A failing test.
3. A concrete implementation sketch.
4. Exact commands.
5. A commit boundary.

### Type Consistency Check

The plan uses these names consistently across tasks:
1. `SessionRecovery`
2. `resolveSessionHref`
3. `HomeRoute`
4. `JobRunPage`
5. `DeliveryPage`
6. `PromptComposer`
7. `RecoveredContextPanel`
8. `RunActionBar`
9. `DeliveryExportPanel`

No later task renames or overloads those identifiers.
