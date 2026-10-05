# AGENTS.md — Splitr

Instructions for coding agents (Codex CLI). Read this first, every session.
Product truth lives in `docs/PRD.md`. Process lives in `docs/WORKFLOWS.md`.

## What this project is
Splitr: shared-expense ledger with receipt claim links, explainable debt simplification, and UPI-native settlement. India-first, mobile-first. We never hold money.

## Stack
- Next.js (App Router) + TypeScript (**strict**)
- Convex (database, functions, file storage, scheduled jobs)
- Auth: Clerk (see PRD open questions; do not swap without asking)
- Tailwind CSS + shadcn/ui (Radix), lucide-react icons
- Zod for all external input validation
- Vitest (unit), Playwright (e2e), ESLint + Prettier
- Package manager: pnpm
- Deploy: Vercel (one project) + one Convex project

Before adding any dependency: check whether the stack already does it. Justify new deps in the PR/commit message.

## Commands
```
pnpm dev            # next dev + convex dev
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run
pnpm test:e2e       # playwright
pnpm check          # lint + typecheck + test  (must pass before you finish)
```
If a command does not exist yet, create it as part of the task rather than skipping verification.

## Repo layout
```
app/                  routes only; thin; no business logic
components/ui/        shadcn primitives (do not hand-edit lightly)
components/           feature components, grouped by feature
convex/               schema.ts, queries, mutations, actions, helpers
lib/ledger/           PURE TS money + split + balance + simplify engine (no I/O)
lib/                  shared utils, formatters, zod schemas
docs/                 PRD.md, WORKFLOWS.md, CODEX_PROMPTS.md, ADRs
e2e/                  Playwright specs
```

## Non-negotiable rules

### Money
1. Amounts are **integers in minor units** (paise). Never use floating point for money. No `parseFloat` on amounts outside the single `parseMoneyInput` function.
2. Every split must sum exactly to the total. Distribute remainders with largest-remainder, ties broken by stable member order.
3. All money logic lives in `lib/ledger/` as pure functions with unit and property-based tests. UI and Convex functions call it; they do not reimplement it.

### Security
4. Every Convex query/mutation/action checks authentication and group membership via shared helpers (`requireUser`, `requireMember`). No exceptions. Guest actions require a valid scoped token.
5. Validate all arguments with Convex validators; validate AI output and URL/form input with Zod.
6. Never commit secrets. Use env vars; keep `.env.example` current. Never log PII (emails, UPI IDs, receipt contents).
7. Never send emails or UPI IDs to AI providers.

### Data
8. Expenses are append-only revisions. Edits create a new revision; deletes are soft.
9. Use indexes (`withIndex`) for queries. No unbounded `.collect()` on growing tables; paginate.
10. Schema changes must be backward-safe or include a migration note in `docs/adr/`.

### Code quality
11. TypeScript strict. No `any` (use `unknown` + narrowing). No `// @ts-ignore` without a linked reason.
12. Components: server components by default; add `"use client"` only when needed. Keep components < ~200 lines; extract hooks and subcomponents.
13. No dead code, no commented-out blocks, no leftover `console.log`.
14. Names are domain terms from the PRD: `group`, `member`, `expense`, `revision`, `settlement`, `claim`.
15. Prefer small, composable functions. Prefer explicit over clever.

### UX
16. Mobile-first; test at 360px width first. Touch targets ≥ 44px.
17. Every async UI has loading, empty, and error states.
18. Accessible by default: labels, focus states, keyboard support, `aria-live` for toasts, no color-only meaning.
19. Use existing design tokens; do not hard-code colors or spacing.

### AI features
20. AI output is a **draft**, never auto-committed. Always user-confirmed.
21. Every AI feature has a deterministic fallback and a timeout. Failures degrade to the manual form.

## Testing expectations
- New ledger logic: unit tests + property-based tests (sums conserve, balances net to zero, simplification preserves nets).
- New Convex functions: at least one authorization-failure test.
- New user-visible flows: one Playwright happy-path test.
- Bug fix: add a failing test first.

## How to work
1. Restate the task and list the files you expect to touch. For anything non-trivial, write a short plan first and wait for approval if the task says "plan first".
2. Make the smallest coherent change. Do not refactor unrelated code.
3. Run `pnpm check` and fix everything before finishing.
4. Finish with a summary: what changed, how you verified, risks, follow-ups.
5. If requirements are ambiguous or conflict with this file or the PRD, **stop and ask** instead of guessing.

## Commit style
Conventional Commits: `feat(ledger): add largest-remainder splitting`. One logical change per commit.

## Do not
- Do not touch `.env*` files with real values, or the legacy archive.
- Do not add analytics/trackers or ads.
- Do not store or process payments.
- Do not change the PRD without being asked; propose changes in your summary.
- Do not install a UI kit alongside shadcn/ui.
