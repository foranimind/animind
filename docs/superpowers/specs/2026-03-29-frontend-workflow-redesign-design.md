# Frontend Workflow Redesign

Date: 2026-03-29
Scope: `apps/web`

## Context

The current frontend is organized around a single creation page that keeps chat, option selection, run-state monitoring, and delivery review inside one page shell. This structure no longer matches the product.

The product is not a chatbot. Users do provide text prompts, and prompt input remains the primary input method, but the product's core value is multimodal generation and delivery: video, music, scene assets, preview, and export. The current UI over-weights the chat surface, under-weights run-state and delivery, duplicates status information across chat and side panels, and uses a page-internal stage switch where route-level separation is now required.

## Goals

1. Make text prompt input the core interaction on the create page without letting chat dominate the full lifecycle.
2. Split creation, live generation, and delivery into separate route-level pages with clear responsibilities.
3. Give the running experience and the delivery experience their own first-screen visual hierarchy.
4. Remove duplicated state rendering across chat history and side panels.
5. Make cancel, failure, success, refresh, and reopen behavior deterministic and page-correct.
6. Reuse the existing preview, session, and job-subscription foundations where they still fit.

## Non-Goals

1. Rebuild the asset preview stack from scratch.
2. Replace the current sidebar or library concepts with a new navigation model.
3. Introduce a new backend task model.
4. Solve every visual polish issue in the same step as route and state disentangling.

## Approved Product Decisions

1. The overall route flow is:
   - Create page: `/`
   - Generate page: `/jobs/:id`
   - Delivery page: `/works/:id`
2. The create page remains a lightweight prompt kickoff page.
3. Prompt input remains the primary create-page interaction.
4. The generate page is a dedicated live job page.
5. The delivery page is a dedicated post-completion handoff page.
6. Success automatically routes from the generate page to the delivery page.
7. Failure automatically routes from the generate page back to the create page.
8. Cancel automatically routes from the generate page back to the create page.
9. Failure and cancel recovery on the create page must preserve prompt, options, and lightweight history.
10. The generate page uses a dual-core layout: process state plus live preview.
11. The delivery page uses a dual-core layout: result preview plus asset delivery/export.

## Information Architecture

### 1. Create Page `/`

Purpose:
Accept the user's prompt, let the user shape generation intent, and launch a job.

Primary content:
1. Large prompt composer with multiline input.
2. Prompt helpers such as templates, examples, and shorthand inserts.
3. Core generation options needed before submission.
4. Start action.

Secondary content:
1. Compact recovered history.
2. System hints.
3. Recovery banner after cancel or failure.

The create page must not contain:
1. Live run logs as a primary surface.
2. Ongoing job status as a first-class layout mode.
3. Delivery review and export panels.

### 2. Generate Page `/jobs/:id`

Purpose:
Monitor active work, show what the system is currently doing, expose live preview, and provide operational controls such as cancel.

Primary content:
1. Stage timeline and current phase.
2. Queue and progress indicators.
3. Log and operational metadata.
4. Cancel action.
5. Live preview surface for scene, motion, and music where available.

This page exists only for active jobs. It is not a mixed-mode page. Once the job reaches a terminal state, the user is routed away.

### 3. Delivery Page `/works/:id`

Purpose:
Present completed output and make the generated assets easy to inspect, preview, export, and download.

Primary content:
1. Hero preview and playback surface.
2. Result review for scene, motion, and music.
3. MP4/BVH/WAV/ZIP delivery actions.
4. Export options and result metadata.

This page assumes the job is complete. It is not responsible for monitoring a live run.

## Route Responsibilities

### Create Route

Inputs:
1. Current draft prompt.
2. Saved prompt helpers and options.
3. Recovery data from the last failed or canceled run.

Outputs:
1. Session update.
2. Job creation request.
3. Navigation to `/jobs/:id`.

### Generate Route

Inputs:
1. `jobId`.
2. Job status stream and polling fallback.
3. Saved session context for display.

Outputs:
1. Live status UI.
2. Cancel request.
3. Navigation to `/works/:id` on success.
4. Navigation to `/` on failure or cancel, with recovery state restored.

### Delivery Route

Inputs:
1. `jobId`.
2. Manifest.
3. Preview config.
4. Asset URLs and export settings.

Outputs:
1. Preview playback.
2. Download actions.
3. Export actions.

## Page-Level UI Design

### Create Page Layout

The create page should be organized around a dominant prompt composer rather than a dominant chat thread.

Recommended structure:
1. Main prompt composer block in the most visually prominent area.
2. Immediate helper row for examples, templates, or prompt inserts.
3. A concise settings block for style, mood, duration, and advanced options.
4. A compact recovered history strip below or beside the composer, clearly secondary to input.
5. A recovery banner at the top when the user returns after failure or cancel.

The recovered history is intentionally lightweight. It should preserve context without recreating the old large chat-first interface.

### Generate Page Layout

The generate page should use a dual-core split.

Left/core process area:
1. Stage timeline.
2. Current phase and queue context.
3. Progress indicator.
4. Live run logs.
5. Control actions including cancel.

Right/core preview area:
1. Live preview surface.
2. Scene preview or fallback preview state.
3. Audio preview or current media availability state.
4. Motion/scene/music progress hints as assets become available.

The page should make it obvious what is happening and what is already viewable. It must not repeat the same run-state inside a separate chat-style message feed.

### Delivery Page Layout

The delivery page should also use a dual-core split, but the emphasis changes from process to outcome.

Left/core result area:
1. Hero preview player.
2. Playback and review of generated content.
3. Result metadata summary.

Right/core delivery area:
1. MP4/BVH/WAV/ZIP assets.
2. Download and open actions.
3. Export settings.
4. Result status notes for missing previews or partial outputs.

The user should not need to dig through tabs or a narrow side inspector just to reach the actual outputs.

## Component Strategy

### Keep and Reuse

These parts should remain conceptually intact:
1. `AppLayout`
2. `AppSidebar`
3. `PreviewPanel` and the preview rendering stack
4. `SelectMenu`
5. `useJobRunner` transport and subscription logic
6. Session index and recent works persistence foundations

### Split and Refactor

These parts should not survive in their current page-bound form:
1. `CreateChatPanel`
   - Split into a prompt-focused composer and a compact history presentation.
2. `InspectorOptionsPanel`
   - Reframe as create-page settings, not an inspector stage.
3. `InspectorProgressPanel`
   - Split into generate-page process modules such as timeline, logs, and actions.
4. `InspectorResultsPanel`
   - Split into delivery-page assets and export modules.
5. `CreatePage`
   - Remove ownership of running and complete modes.

### New Route-Level Components

Recommended new top-level page composition:
1. `CreatePage`
   - `PromptComposer`
   - `PromptHelperBar`
   - `CreateSettingsPanel`
   - `RecoveredContextPanel`
2. `JobRunPage`
   - `RunTimelinePanel`
   - `RunStatusSummary`
   - `RunLogPanel`
   - `RunActionBar`
   - `RunPreviewPane`
3. `DeliveryPage`
   - `DeliveryHeroPreview`
   - `DeliveryAssetsPanel`
   - `DeliveryExportPanel`
   - `DeliveryMetaPanel`

The exact filenames can be finalized in the implementation plan, but ownership must follow this route-level split.

## State Ownership

### Create Page Owns

1. Editable prompt draft.
2. Prompt helpers and prompt insertion interactions.
3. Pre-submit options.
4. Recovery banner and compact historical context.

### Generate Page Owns

1. Active job subscription lifecycle.
2. Run-state rendering.
3. Cancel action presentation.
4. Preview availability during execution.

### Delivery Page Owns

1. Completed result presentation.
2. Asset delivery and export UI.
3. Delivery-specific fallback states.

### Shared Store Owns

1. Session index.
2. Active session id.
3. Persisted prompt and option context.
4. Recovery metadata after failure or cancel.
5. Routing hints for reopen and resume.

## Session and Persistence Model

The current `SessionDetail` model stores create-page-local UI modes such as `inspectorStage` and `activeTab`. Those fields reflect the old single-page design and should no longer be treated as the main source of truth.

The session model should instead preserve cross-route context:
1. Session identity and timestamps.
2. Session status.
3. `jobId`.
4. Last submitted prompt.
5. Current editable draft.
6. Create-page options.
7. Lightweight message history suitable for recovery.
8. Recovery metadata for failure or cancel.
9. Preview or work metadata needed by sidebar/library surfaces.

The route itself should determine which page is active. Page-specific presentation state should stay local to the owning page unless it is necessary for reopen behavior.

## Navigation and Resume Rules

### On Submit

1. Save prompt and options into session context.
2. Create a job.
3. Navigate to `/jobs/:id`.

### While Running

1. Sidebar entry and reopen behavior should land on `/jobs/:id`.
2. Refresh should reattach the active run page if the job is still active.

### On Success

1. Mark the session as complete.
2. Save recent work metadata.
3. Navigate automatically to `/works/:id`.

### On Failure

1. Mark the session as error.
2. Save recovery metadata including error message and last known stage if available.
3. Return to `/`.
4. Restore prompt, options, and compact history.

### On Cancel

1. Mark the session as canceled.
2. Save cancellation recovery metadata.
3. Return to `/`.
4. Restore prompt, options, and compact history.

### On Reopen From Sidebar Or Refresh

Session status determines landing route:
1. `draft`, `error`, `canceled` -> `/`
2. `queued`, `running` -> `/jobs/:id`
3. `done` -> `/works/:id`

## Error Handling and Partial Result Rules

1. A successful job with missing `preview_config` still routes to the delivery page.
2. The delivery page must distinguish between:
   - full success with preview
   - success with partial preview availability
   - delivery assets available but some preview surfaces missing
3. Missing preview data on success must not route the user back into running or create flows.
4. Failure and cancel recovery on the create page must use concise recovery banners instead of reviving a full run log stream.

## Duplication Rules

The redesign must remove duplicated information ownership.

Disallowed states:
1. Live run-state rendered both in the create-page history and the run-page main body.
2. Result delivery rendered inside the create-page side panel.
3. Cancel controls visible on completed delivery surfaces.
4. Active jobs visually treated as if they are still in the create page.

## Visual Direction Constraints

1. The create page should feel like a launch surface, not a chat transcript.
2. The generate page should feel operational and alive, with equal emphasis on progress and preview.
3. The delivery page should feel conclusive and artifact-focused, with immediate confidence around preview and download.
4. Progress and delivery content must no longer be visually compressed into a narrow inspector that behaves like a subordinate side panel.

## Testing Strategy

### Route and Flow Tests

Add tests that verify:
1. Submit from create page navigates to generate page.
2. Success navigates from generate page to delivery page.
3. Failure navigates from generate page back to create page with restored prompt and recovery state.
4. Cancel navigates from generate page back to create page with restored prompt and recovery state.
5. Sidebar and reopen behavior land on the correct route for each session status.

### Page Contract Tests

Add tests that verify:
1. Running jobs do not expose delivery-state UI.
2. Completed jobs do not expose cancel actions.
3. Delivery page shows assets even when preview config is incomplete.
4. Create page recovery mode shows compact history rather than full run logs.

### Component Tests

Shift test focus away from the old `Inspector*` stage model and toward:
1. Prompt composer and recovery presentation.
2. Generate-page timeline, logs, controls, and preview contract.
3. Delivery-page asset and export contract.

## Implementation Constraints

1. Do not rebuild the whole frontend around another monolithic page.
2. Split routing and state ownership before doing visual polish.
3. Reuse the preview and job transport foundations where they already work.
4. Add `.superpowers/` to `.gitignore` during implementation to avoid polluting the repository with brainstorming artifacts.
5. Keep route and session semantics explicit; avoid hidden page-internal stage machines for lifecycle transitions that are now route-level behaviors.

## Summary

The redesign moves the frontend from a chat-centered single-page shell to a route-centered workflow:
1. Create page for prompt-led kickoff.
2. Generate page for live operational monitoring and preview.
3. Delivery page for finished output review and handoff.

This structure matches the product's actual value, removes duplicated state rendering, and provides deterministic recovery behavior for success, failure, cancel, refresh, and reopen flows.
