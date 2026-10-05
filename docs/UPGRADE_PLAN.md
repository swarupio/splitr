# UPGRADE_PLAN.md — Upgrading the existing Splitr repo in place

This **replaces Phases 0–4 of `CODEX_PROMPTS.md`** for the existing `swarupio/splitr` repo (Next.js + JavaScript + Convex + shadcn/ui, npm, React 18 pinned). From Phase 5 onward, use `CODEX_PROMPTS.md` as written, with one change: wherever a prompt says "implement", read it as "extend or replace the existing implementation; reuse what is sound".

## Strategy: strangler, not rewrite

1. Freeze behavior and clean the mess (audit, delete dead code, secure secrets).
2. Add a safety net (lint, typecheck, tests, CI) around what exists.
3. Build the new pure `lib/ledger/` engine beside the old code.
4. Move one feature at a time onto the engine, deleting the old path each time.
5. Only then add the new differentiating features (PRD D1–D8).

The app stays deployable after every merged PR.

---

## Step 0 — Manual prep (you, not Codex)

1. `git switch -c upgrade/base` and tag the current state: `git tag legacy-pre-upgrade`. This is your rollback point.
2. Add the four docs: `AGENTS.md` at the root; `PRD.md`, `WORKFLOWS.md`, `CODEX_PROMPTS.md`, `UPGRADE_PLAN.md` in `docs/`. Commit as `docs: add project constitution`.
3. **Secrets:** `test-key.js` and `list-models.js` sit in the repo root. Search history (`git log -p -S"AIza" -S"sk-" -S"key"` or use `gitleaks`). If any real key was ever committed, revoke and rotate it, even though the files will be deleted.
4. **Deployments:** the repo shows 10 deployments across several Vercel projects (`splitr`, `splitr-ey17`, `splitr-4pfu`). Keep one, delete the others, and point it at this repo.
5. **Data decision (yours):** if the current Convex deployment holds only test data, you can reset it and let the new schema start clean. If real users exist, Phase B below includes a migration path. Decide before Phase D.
6. Package manager: the repo uses `package-lock.json`, so this plan uses **npm**. `AGENTS.md` has been updated to match.

---

## Phase A — Audit (read-only)

```
Preamble: Read AGENTS.md, docs/PRD.md, docs/WORKFLOWS.md and docs/UPGRADE_PLAN.md. This is an EXISTING codebase being upgraded in place. Do not modify any files in this task except creating docs/AUDIT.md.

Task: Audit the whole repo and write docs/AUDIT.md covering:
1. Inventory: routes in app/, components, hooks, lib, every Convex table and function. One line each on what it does.
2. Money handling: every place amounts are parsed, stored, computed or displayed. Flag floats, rounding, and any split logic. Note the stored amount type in the schema.
3. Auth and authorization: for each Convex function, how it checks the caller and group membership. Flag gaps. Review middleware.js.
4. Security: secrets in code or history hints, test-key.js and list-models.js contents (do NOT print any key values), env usage, client-exposed variables.
5. Dead code and duplication: unused files, components, dependencies, unreachable routes.
6. Dependency health: outdated or conflicting packages, why React is pinned to 18 (calendar), unused deps.
7. Performance: unbounded queries, missing indexes, client components that could be server components.
8. Accessibility and UX: missing loading/empty/error states, mobile layout problems.
9. A ranked remediation list (P0 security/money correctness, P1 structure, P2 polish) with rough effort.
10. A mapping from existing features to PRD features: keep / rewrite / delete.

Stop after writing the file and summarize the top 10 findings.
```

Review `docs/AUDIT.md` yourself. Edit priorities before moving on.

---

## Phase B — Safety net and cleanup

```
Preamble (same as Phase A).

Task: Make the repo safe to change, without altering product behavior.

Do:
- Delete test-key.js and list-models.js and any other throwaway scripts the audit flagged. Ensure .gitignore covers .env*, .next, node_modules, coverage, playwright output.
- Create .env.example listing every env var used, with comments and no real values.
- Remove unused dependencies and dead files that the audit marked safe (list each removal in the commit message).
- Add scripts matching AGENTS.md: lint, typecheck, test, test:e2e, check. Add Prettier, Vitest, fast-check.
- Enable TypeScript in allowJs mode: add tsconfig.json with allowJs true, checkJs false, strict true for new .ts/.tsx files. Convert jsconfig.json paths into tsconfig.
- Add GitHub Actions CI (install, lint, typecheck, test, build).
- Add one Playwright smoke test for the current main flows (sign in page loads, groups page loads when authenticated if feasible).
- Fix P0 authorization gaps from the audit using shared helpers in convex/lib/auth.ts (requireUser, requireMember). One commit per fixed function group, each with an authorization-failure test.

Constraints: no UI redesign, no schema changes yet, no feature work.
Acceptance: `npm run check` passes, CI green, app behaves exactly as before.
```

---

## Phase C — Incremental TypeScript migration

```
Preamble (same).

Task: Migrate JavaScript to TypeScript incrementally, folder by folder, no behavior changes.

Order: lib/ -> hooks/ -> convex/ (including generated types) -> components/ -> app/.
For each folder: rename .js/.jsx to .ts/.tsx, add real types (no `any`; use `unknown` + narrowing), fix errors properly rather than suppressing. Commit per folder. Keep the app building after every commit.
Finish by setting checkJs irrelevant, removing allowJs, and enabling strict everywhere.
Do not upgrade React or other major dependencies in this task.

Acceptance: zero .js/.jsx source files remain (config files may stay .mjs), `npm run check` passes.
```

---

## Phase D — Ledger engine adoption and schema migration

Step D1 — engine (identical to Phase 3 in CODEX_PROMPTS.md). Run that prompt unchanged.

Step D2 — adopt it:

```
Preamble (same).

Task: Move existing expense and balance logic onto lib/ledger, then migrate the schema. Work in small commits; keep the app working after each.

1. Replace every existing split/balance computation with calls to lib/ledger. Delete the old logic in the same commit it is replaced.
2. Schema migration using the widen -> migrate -> narrow pattern:
   a. Widen: add new tables/fields (members with guest support, expenseRevisions, settlements with status, activity) alongside existing ones, all optional.
   b. Migrate: write an idempotent Convex migration that converts existing groups, members and expenses into the new shape. Amounts become integer paise. Where the legacy amount was a float, round to the nearest paise and log any expense whose rounded splits did not reconcile, with its id (no PII).
   c. Cut over reads and writes to the new shape.
   d. Narrow: after verifying, remove legacy fields and tables in a separate PR.
3. Write docs/adr/0002-migration.md describing the steps and rollback.
4. Provide a dry-run mode for the migration that reports counts and anomalies without writing.

Tests: migration idempotency (run twice = same result), reconciliation anomalies reported, balances before vs after migration identical for a seeded fixture.
Acceptance: balances for seeded legacy data match before and after, FR-1 and FR-2 hold.
```

If your Convex data is disposable, tell Codex: "Data is disposable; skip the migration steps b and d and just replace the schema." That is faster and cleaner.

---

## Phase E — Design system and shell refactor

Run Phase 2 from `CODEX_PROMPTS.md`, with this addition at the top of the prompt:

```
This is an existing UI. First list which existing components map to the new design system components. Replace them feature by feature (groups list, group page, expense list, expense form). Delete the old component in the same commit it is replaced. Keep shadcn/ui primitives; do not add another UI kit.
```

---

## Phase F — Dependency upgrades (after everything is green)

```
Preamble (same).

Task: Upgrade dependencies safely.

1. Investigate why React was pinned to 18 for the calendar. Check whether the current shadcn/ui calendar (react-day-picker) supports the current React version, or whether a native date input is enough for our needs.
2. Upgrade one major dependency at a time (React/Next first, then others), running `npm run check` and the Playwright suite after each, one commit each.
3. If the calendar still blocks a React upgrade, propose options (replace the calendar, use a native date input) and wait for my choice.
Record outcomes in docs/adr/0003-dependencies.md.
```

---

## Then continue

After Phase F, run Phases 5 onward from `CODEX_PROMPTS.md`:

- Phase 5 (expenses with revisions): extend what Phase D already built rather than starting over.
- Phase 6 (balances, explainable settlement, UPI)
- Phase 7 (Say it), 8 (receipt claim links), 9 (disputes, nudges), 10 (pair net, Trip Wrapped), 11 (multi-currency, recurring, PWA), 12 (hardening)

Phase 12's audit prompt can reuse `docs/AUDIT.md` as its baseline.

## Order at a glance

| Step | Goal | Risk |
|---|---|---|
| 0 | Tag, docs, secrets, one Vercel project | none |
| A | Read-only audit | none |
| B | Safety net, cleanup, auth fixes | low |
| C | JS to TS | low |
| D | Engine and schema migration | **highest** — dry-run first |
| E | Design system | medium |
| F | Dependency upgrades | medium |
