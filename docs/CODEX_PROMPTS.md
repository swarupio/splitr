# CODEX_PROMPTS.md — Prompt sequence for rebuilding Splitr

> **Existing repo?** Use `docs/UPGRADE_PLAN.md` instead of Phases 0–4 below, then continue from Phase 5.

Run these in order. One prompt = one fresh Codex session = one branch = one PR.
Every prompt assumes `AGENTS.md`, `docs/PRD.md` and `docs/WORKFLOWS.md` are in the repo.

Prompt header used everywhere (already included below as "Preamble"):

> Read AGENTS.md, docs/PRD.md and docs/WORKFLOWS.md first. Plan before coding and wait for my approval of the plan. Finish only when `npm run check` passes. If anything is ambiguous, ask.

---

## Phase 0 — Manual reset (you do this, not Codex)

1. On GitHub, rename `swarupio/splitr` to `splitr-legacy`, make it **private**, then archive it. Tag the last commit `legacy-final`.
2. Check the legacy history for committed secrets (`test-key.js` and `list-models.js` suggest API keys may have been used). If any key was ever committed, **revoke and rotate it** at the provider. Do this even though the repo is now private.
3. Create a new empty repo `splitr`. Do not copy any legacy files.
4. Vercel: delete the old projects (there are several `splitr*` production projects) and create one new project for the new repo.
5. Convex: create a brand-new project. Do not reuse the old deployment or its data.
6. Auth: create a fresh Clerk application (or delete old test users) and use new keys.
7. Locally: `mkdir splitr && cd splitr && git init`, then put `AGENTS.md` at the root and `PRD.md`, `WORKFLOWS.md`, `CODEX_PROMPTS.md` in `docs/`. Commit as `docs: add project constitution`.

---

## Phase 1 — Foundation and tooling

```
Preamble: Read AGENTS.md, docs/PRD.md and docs/WORKFLOWS.md first. Plan first and wait for approval. Finish only when `npm run check` passes.

Task: Bootstrap the project from scratch in this empty repo.

Requirements:
- Next.js (latest stable, App Router) + TypeScript strict, Tailwind, ESLint, npm.
- Initialize shadcn/ui. Add only: button, input, label, card, dialog, drawer, sheet, tabs, toast (sonner), dropdown-menu, avatar, badge, skeleton, select, checkbox, form.
- Initialize Convex and Clerk with env placeholders. Create `.env.example` listing every variable with comments. Never write real keys.
- Add Vitest, fast-check (property tests), Playwright (one smoke test that loads the home page), Prettier.
- Scripts in package.json exactly as listed in AGENTS.md, including `check`.
- Folder structure exactly as in AGENTS.md (create empty dirs with .gitkeep where needed).
- GitHub Actions workflow: install, lint, typecheck, test, build on PRs.
- `docs/adr/0001-stack.md` recording stack decisions.
- A minimal landing page and a protected `/app` route that requires sign-in.

Constraints: do not add dependencies beyond what is listed unless you justify them in the plan.
Acceptance: `npm run dev` runs, `npm run check` passes, CI file valid, sign-in gates `/app`.
```

## Phase 2 — Design system and app shell

```
Preamble (same).

Task: Create the visual foundation and mobile-first app shell.

Design direction: calm, trustworthy, slightly playful fintech. Not a Splitwise lookalike. Generous spacing, strong number typography (tabular figures), one accent color, semantic colors for owed/owe that also use icons/text (never color alone).

Deliver:
- Design tokens in Tailwind/CSS variables: color (light + dark), radius, spacing scale, type scale. Pick a distinctive font pair via next/font.
- Components: `Money` (formats paise to ₹ with Indian digit grouping, tabular-nums, sign/direction label), `MemberAvatar` (initials fallback, guest indicator), `EmptyState`, `ErrorState`, `PageHeader`, `BottomNav` (mobile) and `Sidebar` (desktop).
- App shell: bottom nav on mobile (Groups, Activity, Settle, Me), sidebar on desktop, theme toggle.
- A `/design` dev-only route showing every component in all states.
- Unit tests for `Money` formatting (₹1,00,000.50 style grouping, negatives, zero).

Acceptance: usable at 360px, keyboard navigable, Lighthouse a11y ≥ 95 on /design.
```

## Phase 3 — Ledger engine (pure, heavily tested)

```
Preamble (same).

Task: Implement `lib/ledger/` as pure TypeScript with no I/O.

Modules:
1. `money.ts`: `Minor` branded integer type, `parseMoneyInput(string) -> Minor` (the only place text becomes money; reject floats beyond 2 decimals), `formatMinor`, safe add/sub.
2. `split.ts`: functions `splitEqual`, `splitExact`, `splitPercent` (basis points), `splitShares` (weights), each returning `{memberId, owedMinor}[]`. Use largest-remainder rounding; ties broken by stable member order. Throw typed errors on invalid input (exact amounts not summing, percent != 100%).
3. `balances.ts`: compute per-member net balances from expense revisions (multiple payers supported) and confirmed settlements. Output also a per-pair ledger to support explanations.
4. `simplify.ts`: minimum-cash-flow greedy simplification (largest creditor vs largest debtor). Return payments AND an explanation structure: for each payment, the list of contributing expenses/balances (document the approach and its limits in a comment: greedy gives at most n-1 payments, not always the global minimum).
5. `types.ts`: shared types.

Tests (Vitest + fast-check):
- splits always sum exactly to total, for random totals and member counts.
- balances sum to exactly 0.
- simplification preserves every member's net and never increases payment count versus raw pairwise debts.
- deterministic output for same input.
- rounding edge cases: ₹100 / 3, ₹0.01 / 3, 1 paise across 7 people.

Acceptance: ≥ 95% line coverage in lib/ledger, all FR-1..FR-4 demonstrably covered.
```

## Phase 4 — Schema, auth helpers, groups, members, guests

```
Preamble (same).

Task: Implement the Convex schema and group/member management.

Do:
- `convex/schema.ts` for users, groups, members, expenses, expenseRevisions, settlements, activity (see PRD §9; skip receiptSessions, disputes, nudges for now). Add indexes for every query you write.
- `convex/lib/auth.ts`: `requireUser`, `requireMember(ctx, groupId)`, `requireOwner`. All functions use them.
- User sync from Clerk on first sign-in.
- Groups: create, list mine, get, update, archive.
- Members: add guest by name, invite link (random token, store only the hash, expiry, revocable), join via link, leave, owner removes.
- Guest tokens: scoped to one group/member; hashed; expiring; revocable.
- UI: groups list, create group dialog, group page shell with members tab, invite sheet (copy link + share).
- Guest to account claim flow ("Save my history").

Tests: authorization-failure test for every mutation (non-member cannot read or write; guest cannot act outside scope; expired token rejected).
Acceptance: Playwright W1 and W8 pass.
```

## Phase 5 — Expenses with revisions

```
Preamble (same).

Task: Expense CRUD built on revisions, using lib/ledger only for math.

Do:
- Mutations: createExpense, editExpense (creates new revision with optional reason), deleteExpense (soft), restoreExpense. Idempotency key on create.
- Server re-validates splits with lib/ledger even if the client sent them.
- Expense form (drawer on mobile): amount (parseMoneyInput), title, payer(s), participants, split method (equal/exact/percent/shares), category, date, note. Defaults: payer = me, participants = all, equal. Live preview of each person's share.
- Expense list with filters (member, category, date), pagination, "Edited" badge, history view with a readable diff between revisions.
- Activity entries for create/edit/delete.
- Undo toast after create/delete.

Tests: edit creates a revision and keeps the old one; non-members blocked; server rejects splits that do not sum.
Acceptance: W2 and W3 pass; adding an expense takes ≤ 4 taps after typing amount.
```

## Phase 6 — Balances, explainable settlement, UPI

```
Preamble (same).

Task: Balances UI, "Why this payment?", and UPI settlement.

Do:
- Balances query computed from lib/ledger (no cached copies yet). Group balances view + per-member breakdown.
- Settle screen showing suggested payments (respect group.simplifyDebts toggle).
- "Why?" sheet: readable explanation from the engine's explanation trail, plus a simple graph/flow view (SVG, accessible, with a text alternative).
- Settlement lifecycle per FR-9: proposed -> confirmed | rejected; payer can cancel while proposed. Receiver confirm banner and activity entries.
- UPI: build the intent link (`upi://pay` with pa, pn, am, cu=INR, tn) with a pure, unit-tested builder that validates the VPA format and amount. Show a QR fallback and a "copy UPI ID" fallback. User profile gets an optional UPI ID field.
- Never claim a payment is verified; copy must say "marked as paid".

Tests: lifecycle authorization (only receiver confirms), link builder edge cases, engine explanation completeness (FR-4).
Acceptance: W4 passes on a real phone with a real UPI app (manual check, note the result in the PR).
```

## Phase 7 — "Say it" quick add (AI, text first)

```
Preamble (same).

Task: Natural-language expense drafting.

Do:
- `lib/parse/` deterministic fallback parser: amount (₹, rs, k suffix like 1.2k), "paid by <name|me>", "with <names>", "skipped <names>", "split equally|exact", simple categories by keywords. Unit-tested with at least 30 example sentences, including Hinglish samples.
- Convex action calling the chosen AI provider server-side with: a strict system prompt, Zod-validated JSON output, 8 s timeout, per-user rate limit. Send only first names of group members and the typed sentence. Never send emails or UPI IDs.
- Result is a DRAFT object; UI shows a draft card with editable chips; user must confirm. Ambiguous names show a picker.
- Fallback: provider failure or invalid JSON -> deterministic parser result -> prefilled manual form.
- ADR documenting provider choice, cost per call, and privacy handling.
- Optional: mic button using the browser Web Speech API where supported, feeding the same text box.

Tests: parser table tests; Zod rejection of malformed AI output; rate-limit test; fallback path test.
Acceptance: W6 passes; amounts are shown prominently in the draft card for verification.
```

## Phase 8 — Receipt claim links

```
Preamble (same).

Task: Receipt scanning and claim links.

Do:
- Add `receiptSessions` to the schema. Upload image to Convex storage (size/type limits, strip EXIF).
- Convex action extracts items, quantities, prices, and charges (tax, service, tip, discount) via the AI provider as structured JSON validated by Zod. Show a reconcile check: items + charges must equal the total, otherwise flag it.
- Editable review screen: fix names/prices, add or remove items, mark charges.
- Share link with hashed token and expiry. Public claim page (no sign-in): enter name -> tap items -> shared items split among claimers; charges allocated proportionally; live updates.
- Allocation function lives in `lib/ledger/claims.ts` (pure, property-tested: sums conserve; unclaimed handled).
- Organizer view: progress, unclaimed items (assign or split equally), Finalize -> creates a normal expense (source=receipt) via the existing expense path.
- Delete the image after finalization or after 7 days via scheduled job.

Tests: allocation properties, claim-token authorization, expiry, reconcile mismatch handling.
Acceptance: W5 passes with a real receipt photo, including a guest on a second device.
```

## Phase 9 — Disputes and nudges

```
Preamble (same).

Task: Trust layer and gentle reminders.

Do:
- Disputes per PRD D6: raise, thread messages, resolve/withdraw; "Disputed" badge; group setting for whether disputed expenses still count (default: yes).
- Nudges per D5: pick a tone, AI-assisted draft with a deterministic template fallback, shown in a share sheet with WhatsApp deep link and copy. No auto-sending. Enforce FR-10 cooldown.
- Activity feed completes with dispute and nudge events.

Tests: dispute authorization, cooldown enforcement, template fallback.
Acceptance: W7 passes.
```

## Phase 10 — Pair net and Trip Wrapped

```
Preamble (same).

Task: Cross-group pair net (D7) and Trip Wrapped (D8).

Do:
- Query: net amount between me and another person across all groups we share (only groups with the same currency; list the rest separately). Combined settlement option that records one settlement mapped back to groups with a clear explanation.
- Trip Wrapped for trip/event groups: stats computed by pure functions in `lib/ledger/insights.ts` (total, per-person paid vs owed, category split, biggest expense, longest-ago unsettled). Keep tone light, never shaming.
- Shareable summary card rendered as an image (server-side OG image or canvas) without exposing private amounts unless the user opts in.

Tests: pair-net correctness on multi-group fixtures; insights unit tests.
Acceptance: pair net explanation matches per-group balances exactly.
```

## Phase 11 — Multi-currency, recurring, export, PWA

```
Preamble (same).

Task: Round out v1.2.

Do:
- Multi-currency: expense currency + stored FX rate at entry time; group balances in the group currency; rates fetched server-side and cached; manual rate override.
- Recurring expenses via Convex scheduled functions (monthly/weekly), creating normal expenses with source=recurring and an activity entry.
- CSV export of group ledger.
- PWA: manifest, icons, installability, offline queue for creating expenses with idempotency keys and a visible "pending sync" state.

Tests: FX rounding conserves totals; recurring job idempotency; offline queue replay without duplicates.
```

## Phase 12 — Hardening and launch

```
Preamble (same).

Task: Security, performance, and polish pass. Audit, do not rewrite.

Produce `docs/AUDIT.md` first (no code changes), covering:
1. Authorization: list every Convex function and how it checks auth; flag gaps.
2. Money: grep for float math on amounts, unsafe parsing, rounding paths outside lib/ledger.
3. Secrets/PII: env usage, logging, AI payload contents.
4. Performance: bundle sizes, unbounded queries, missing indexes, N+1 patterns.
5. Accessibility: run axe on main flows, list violations.
Wait for my approval of the findings, then fix them in priority order with tests.

Finish with: error boundaries, 404/500 pages, rate limiting on public endpoints (claim pages, join links), robots/meta, a privacy page, README for contributors, and a production checklist (env vars, Convex prod deploy, Clerk prod instance).
```

---

## Utility prompts

**Refactor sweep (use sparingly)**
```
Scan <directory> for violations of AGENTS.md (files > 200 lines, any `any`, duplicated money math, missing states). Output a ranked list only. Do not edit files.
```

**Bug fix**
```
Bug: <symptom>. First write a failing test that reproduces it. Explain the root cause, propose the minimal fix, wait for approval, then implement. No unrelated changes.
```

**Explain before touching**
```
Explain how <feature> works end to end (files, data flow, auth checks). Do not modify anything.
```

**Docs sync**
```
Compare docs/PRD.md with the implemented behavior. List mismatches. Propose PRD edits or code fixes, but change nothing until I choose.
```
