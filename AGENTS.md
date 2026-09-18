# Project instructions

These instructions apply throughout this repository.

## Start here

- Read `STATUS.md` for current progress, then `IMPLEMENTATION_PLAN.md` for the design and acceptance criteria.
- Use `README.md` as the project introduction and `DEVLOG.md` for completed work.
- Follow the user's current instructions when they change the plan. Keep proposed defaults distinct from confirmed decisions and implemented behavior.

## Purpose and scope

Build a small Cloudflare chat agent that searches the existing jobs warehouse through fixed, parameterized queries and remembers earlier conversations.
The application lives here. The Python/dbt warehouse lives in the sibling `Job Board Scraper Fable` repository; read its own `AGENTS.md` before working there.
Prefer the official Agents starter, TypeScript, React, Workers AI, Durable Object storage, and Neon's HTTP driver. Check current official documentation when implementing changing SDK interfaces.
Keep the first version small. Additional services or features need a concrete requirement, not hypothetical future scale.

## How to collaborate

- Speak plainly and define unfamiliar stack terms when first used. Explain why a choice matters, not just which files changed.
- Work in small, verifiable steps so the user can understand and defend the implementation in an interview.
- At a milestone boundary, report the outcome, evidence, and next step. Do not ask again for work already authorized.
- Preserve existing user edits. Inspect the working tree before editing; do not reset, discard, or overwrite unrelated work.
- Distinguish local source inspection, fixture tests, production observations, and assumptions. Never claim a check passed unless it ran.

## Application boundaries

- Search only `analytics.mart_job_search` through checked-in SQL with bound values. Never expose arbitrary SQL, identifiers, ordering expressions, or raw-table access to the model.
- Keep the six search parameters: `role_family`, `seniority`, `remote`, `posted_within`, `min_salary`, and `limit`. Use the remote flag only; city, state, and country filtering are out of scope. Validate server-side, including direct browser calls.
- Treat model output, job data, and stored chat text as untrusted. Invalid or unsupported filters must not silently broaden a search.
- Render job facts and links from returned rows. Use deterministic ranking; do not fabricate matches, salary, availability, or counts.
- Preserve distinctions between publication and first-observed dates, inferred seniority, remote-flag limitations, and salary units. See the plan for proposed filter semantics.
- Keep database access read-only and narrowly granted. Never put credentials in source control, browser code, synchronized state, logs, or prompt-history exports.
- Authorize every visitor's HTTP and WebSocket access to their own stored conversation. A client-provided object name alone is not authorization.
- Bound model calls, query duration, result counts, and retained context. Distinguish service failures from empty results.
- Warehouse changes belong in the warehouse repository and must respect its tests, build process, and instructions.

## Verification and records

- Test behavior at the relevant boundary: filter validation, query binding, data semantics, memory isolation, and failure handling. Documentation-only edits need link and consistency checks, not application tests.
- Keep `STATUS.md` current after each completed step; append an evidence-based entry to `DEVLOG.md`.
- Preserve AI coding prompt history using `prompt-history/README.md`. The user is saving chats; do not overwrite exports or invent missing transcripts.
- Keep setup and test commands in `README.md` accurate as the application is built. Do not document unverified commands as working.
- Never mark a planned feature as delivered merely because its documentation exists.
