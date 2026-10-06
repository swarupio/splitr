# Splitr

Shared expenses with friends. The existing app is being upgraded in place; product requirements
are in docs/PRD.md and the phase plan is in docs/UPGRADE_PLAN.md.

## Local development

Use Node.js 24 and npm. Install with npm ci. Set the documented variables from .env.example
in your local Next configuration and Convex dashboard; never commit real values.

Use two terminals, with the same Convex deployment configured on both sides:

1. Run npm run dev for Next.js at http://localhost:3000.
2. Run npx convex dev for Convex function/schema publishing and watching.

This is the deliberate two-terminal alternative to a process-supervisor dependency.
Do not start a second Convex watcher if one is already running.

## Verification

- npm run lint: ESLint.
- npm run typecheck: strict TypeScript for new code; legacy JavaScript remains in allowJs mode.
- npm test: Vitest, including 200 generated expense-authorization examples.
- npm run check: lint, typecheck and Vitest.
- npm run build: production Next.js build.
- npx playwright install chromium: install the smoke-test browser.
- npm run test:e2e: one public-page smoke spec at 360px and desktop; run npm run build first.
  Playwright starts and stops a separate production Next server on port 3100 with dummy settings.
  The smoke test does not exercise live Clerk login, Convex data or email jobs.

## Formatting

Formatting is incremental. Both scripts require explicit paths, so they cannot accidentally
reformat the whole legacy repo:

npm run format -- package.json playwright.config.ts e2e/public-page.spec.ts
npm run format:check -- package.json playwright.config.ts e2e/public-page.spec.ts

Use these commands only for files you touch. Generated files, environment files, local config
and test output are ignored. No whole-repo formatting pass was performed.

See docs/PHASE_B_REVIEW.md for deployment variables, CI build prerequisites and manual checks.
