# apps/web

Web frontend for Animind, built with React, TypeScript, Vite, and Three.js.

## Setup

Install dependencies:

```bash
npm install
```

## Development

Run the dev server:

```bash
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

## Quality Checks

```bash
npm run test
npm run lint
npm run typecheck
```

## Backend Proxy

- Default backend target: `http://localhost:8000`
- Vite forwards `/api` and `/assets` through `VITE_DEV_PROXY_TARGET`
- Leave `VITE_API_BASE` empty to keep the app on same-origin URLs

## Environment Files

- `apps/web/.env.example` - local development example
- `apps/web/.env.production.example` - production-facing example

Common variables:

- `VITE_DEV_PROXY_TARGET`
- `VITE_API_BASE`
- `VITE_USE_MOCK`
- `VITE_BASE`

## Mock Mode

Set `VITE_USE_MOCK=1` before starting the dev server to use local mock assets and simulated job events.

Mock assets live under `apps/web/public/mock/assets/demo_job` and mirror `/assets/<job_id>` paths.

### Demo Flow

1. Start the frontend with `npm run dev`.
2. Open the Create page at `/`.
3. Enter `demo_job` as the Job ID and click `Load preview`.
4. When the create flow is wired, `createJob` returns `demo_job` and SSE events progress through `PLANNING -> RUNNING_MOTION -> RUNNING_SCENE -> RUNNING_MUSIC -> DONE`.
