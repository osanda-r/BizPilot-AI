# BizPilot AI frontend

React + TypeScript + Vite. See the [root README](../README.md) for full setup, environment variables, API behavior, and deployment notes.

```bash
npm ci
npm run dev
```

Start the FastAPI backend on port 8000 first. The development server proxies `/api` and `/health`; browser-facing API calls are same-origin by default.

- `npm test` — component and API-client tests
- `npm run lint` — ESLint, with warnings treated as failures
- `npm run build` — TypeScript check and production build
- `npm run test:browser` — live workflow and accessibility checks; requires both servers and Playwright Chromium
- `npm run test:watch` — interactive unit-test watcher

Fonts are self-hosted through Fontsource. No Google Fonts request or API secret is needed by the browser.
