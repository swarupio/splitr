# WORKFLOWS.md — How we build Splitr with Codex CLI

This is the operating manual for working with the coding agent. `AGENTS.md` says *what rules to follow*; this says *how a session runs*.

---

## 1. Principles

1. **One phase, one branch, one PR.** Phases are defined in `docs/CODEX_PROMPTS.md`.
2. **Plan, then build.** Every non-trivial task starts with a plan you approve.
3. **Engine before UI.** Money logic is pure, tested, and finished before screens depend on it.
4. **Verify, don't trust.** "Done" means `pnpm check` is green and you have looked at the result in a browser at 360px.
5. **Small context, fresh sessions.** Start a new Codex session per task. Context lives in `AGENTS.md` and `docs/`, not in chat history.

---

## 2. Session loop (every task)

```
1. git switch -c <phase>/<task>        # e.g. p3/ledger-engine
2. codex                                # new session
3. Paste the phase prompt                # from docs/CODEX_PROMPTS.md
4. Review the PLAN. Edit or approve.     # reject vague plans
5. Let it implement.
6. Run: pnpm check                       # yourself, not just the agent
7. Manual test (browser, 360px + desktop)
8. Ask Codex for a review pass           # see §5
9. Commit (Conventional Commits), push, open PR
10. Merge only if the phase Definition of Done (§4) is met
```

Tips:
- Prefer approval mode that asks before running commands or writing outside the repo; loosen only for trusted, well-scoped tasks.
- If the agent drifts, stop it, `git diff`, and re-prompt with a narrower scope. Do not stack fixes on a bad base.
- If a session gets long and confused, commit what is good, start a new session, and point it at the files.

---

## 3. Branching and git

- `main` is always deployable.
- Branch names: `p<phase>/<short-task>`.
- Commits: Conventional Commits. Squash-merge PRs.
- Tag at the end of each phase: `phase-3-done`.
- Never commit `.env*`. `.env.example` is committed and kept current.

---

## 4. Definition of Done

### Per task
- [ ] `pnpm check` passes (lint, typecheck, unit tests)
- [ ] New logic has tests; new Convex functions have an authorization-failure test
- [ ] Empty/loading/error states exist for new UI
- [ ] Checked at 360px width and on desktop
- [ ] No new `any`, no stray `console.log`, no dead code
- [ ] Docs updated if behavior or structure changed

### Per phase
- [ ] All tasks done and merged
- [ ] Playwright happy-path for the phase's main flow passes
- [ ] Deployed to Vercel preview and smoke-tested by a human
- [ ] PRD functional requirements touched by the phase are demonstrably met
- [ ] `docs/adr/` has a note for any non-obvious decision

---

## 5. Review workflow

After implementation, open a fresh Codex session and ask for a review, not a rewrite:

```
Review the diff against main (git diff main...HEAD).
Check against AGENTS.md rules and docs/PRD.md requirements FR-1..FR-10 where relevant.
Report: (1) correctness bugs, (2) authorization gaps, (3) money/rounding risks,
(4) missing tests, (5) a11y issues, (6) simplification opportunities.
Do NOT modify files. Rank findings by severity.
```
Then fix findings in a separate, scoped session.

---

## 6. Debugging workflow

1. Reproduce and write a failing test (unit if possible, Playwright otherwise).
2. Ask Codex: "Explain the root cause using the failing test; propose the minimal fix; do not change unrelated code."
3. Apply the fix, confirm the test passes, run `pnpm check`.

---

## 7. Feature workflow (post-MVP features)

1. Update `docs/PRD.md` first (requirement + acceptance criteria).
2. Write an ADR if it changes the data model.
3. Schema + engine changes (with tests).
4. Convex functions (with auth tests).
5. UI.
6. E2E test.
7. Review pass.

---

## 8. Product workflows (how the app should behave)

These are the flows e2e tests must cover.

### W1 — Create group and add people
`Sign in → New group → name + type → add members (name only = guest, or copy invite link) → land on empty group with "Add first expense" CTA.`

### W2 — Manual expense
`+ → amount → payer → participants → split → Save → toast with Undo (soft delete) → balances update live.`

### W3 — Edit with revision
`Expense → Edit → change → optional reason → Save → "Edited" badge → History shows prior revision with diff.`

### W4 — Settle via UPI
`Balances → suggestion → "Why?" opens explanation → Pay → UPI app opens (or QR) → return → "I paid" → settlement = proposed → receiver sees banner → Confirm → balances update.`
Edge cases: receiver has no UPI ID (fallback to cash/other), payer cancels proposal, receiver rejects with reason.

### W5 — Receipt claim
`+ → Receipt → upload → review items/charges → totals reconcile? → Share link → friends claim (guest ok) → organizer sees progress → Finalize → expense created with source=receipt.`
Edge cases: unclaimed items (organizer assigns or splits equally), item claimed by many (equal shares), link expiry.

### W6 — Say it
`Text box → parse → draft card → fix chips → Confirm.` Fallback: provider error → prefilled manual form.

### W7 — Dispute
`Expense → Something's off → note → thread → resolved by edit or withdrawal → activity entry.`

### W8 — Guest to account
`Guest opens link → name → participates → "Save my history" → sign in → guest member linked to user, history preserved.`

---

## 9. Environments and secrets

- Local: `.env.local` (git-ignored). Convex dev deployment.
- Preview: Vercel preview + Convex dev/preview deployment.
- Production: one Vercel project, one Convex prod deployment.
- Secrets live only in Vercel/Convex dashboards and `.env.local`. Rotate on any suspicion of leakage.

---

## 10. CI (set up in Phase 1)

GitHub Actions on every PR: install → `pnpm lint` → `pnpm typecheck` → `pnpm test` → build. Playwright runs on PRs touching `app/`, `components/`, or `e2e/`.

---

## 11. Weekly rhythm (solo)

- Start of week: pick the next phase task, re-read PRD section.
- During: one task per session, merge daily.
- End of week: demo to a friend group on a real trip/dinner, write down friction, update the PRD backlog.
