# Development log

Append a dated entry after each completed step. Record what changed, why, what was actually verified, and anything still outstanding. Keep the current next action in `STATUS.md` rather than repeating it throughout this log.

## 2026-09-18 — Research and implementation plan

- Inspected the local warehouse search mart, location and classification logic, and project status.
- Researched official Cloudflare and Neon documentation for model tool calling, chat persistence, routing, database access, and hosting.
- Created `IMPLEMENTATION_PLAN.md` with the proposed architecture, seven-parameter contract, ranking, memory isolation, safeguards, and completion criteria.
- Identified missing state/country fields in the mart, date-granularity limitations, the title-based mid-level convention, and the remote-flag source discrepancy.
- Evidence was local source inspection and published documentation. No production query, application build, or deployment was performed. The full job posting remained inaccessible through the research tool.

## 2026-09-18 — Project documentation foundation

- Added repository-wide instructions in `AGENTS.md`, emphasizing small explainable steps, fixed SQL, narrow database access, honest data labels, visitor isolation, and evidence-based verification.
- Added `README.md` as the project entry point and `STATUS.md` as the current-state record.
- Added `prompt-history/README.md` to the user's existing folder, with transcript naming, preservation, and redaction guidance. Did not fabricate or replace conversation exports.
- Checked local Markdown links, required instruction coverage, and consistency with the implementation plan. Application tests were not applicable to these documentation-only additions.
- Application and warehouse implementation remain pending.

## 2026-09-18 — Simplify location filtering to the remote flag

- At the user's request, replaced `location` and `state` with a single `remote` parameter in the implementation plan and project instructions. The search contract now has six parameters.
- Documented true/false/null behavior, follow-up clearing, and the distinction between a remote flag and verified on-site or geographic eligibility.
- Removed planned state/country mart additions and geography-specific implementation work. Updated the README and current status; retained earlier log entries as history.
- Verified active documents agree on the six-parameter scope and local Markdown links resolve. No application or warehouse code changed; application tests were not applicable.

## 2026-09-18 — Build the application and production search boundary

- Scaffolded the Cloudflare Agents application with Workers AI, two Durable Objects, a React chat interface, and Neon's HTTP driver.
- Implemented the six-field schema, fixed SQL, trustworthy recency rule, stable ranking, strict result cap, salary behavior, safe URL rendering, filter follow-ups, explicit preference memory, clearing/deletion, 30-day inactivity expiry, signed per-browser identity, same-origin writes, request limits, and a global daily model-call cap.
- Added 21 passing tests across validation, real PostgreSQL fixture execution, date boundaries, null/false/true remote behavior, stable ordering, signed identity, and a live read-only production search. Type checking and the production build pass.
- Created and verified a `job_search_agent` database login with effective SELECT access only to `analytics.mart_job_search`; local and production credentials are gitignored.
- Rebuilt the production mart with its source-aware remote flag and one build timestamp. The selected model plus 12 tests passed. The table holds 178,237 rows; 18,601 rows differ from the former text-derived remote flag and 39,251 are flagged remote.
- Installed Cloudflare's 14 official agent skills and registered/authenticated its five MCP servers. They require a Codex restart to load.
- Visually inspected the built desktop interface. Permanent remote testing and deployment remain blocked by the missing account-wide `workers.dev` subdomain. Automatic approval review also requires explicit user approval before uploading the database and session secrets to Cloudflare.

## 2026-09-18 — Cloudflare production-readiness audit

- Audited the implementation against the installed Cloudflare Agents SDK, Durable Objects, Workers, and Wrangler guidance plus current official documentation.
- Declared both required Worker secrets, enabled sampled request tracing, regenerated binding types, and completed a successful Wrangler deployment dry run.
- Removed the copied local `.dev.vars` file automatically from every production build. The dry-run upload inventory contains application modules and static assets, with no local secret file.
- Renewed the signed browser session on activity so an active conversation remains reachable for the documented 30-day inactivity window. The added renewal test brings the suite to 22 passing tests, including the live read-only database smoke test.
- Retrieved the full Greenhouse posting directly. The assignment submission field asks for the GitHub repository URL and requires prompt history; no additional assignment-specific upload was listed.

## 2026-09-18 — Remote development runtime check

- Confirmed the account-wide `wjcc91.workers.dev` subdomain is enabled and both Vite and Wrangler remote development previews connect successfully.
- Ran the real chat request through the signed session and Durable Object path. The model call failed before database search with a Cloudflare internal error and the application returned its safe, non-broadening fallback.
- Isolated the failure with a development-only direct binding check: a one-word request with no tools failed for both Llama 3.3 and Llama 3.1. This rules out the job-search tool schema and provider wrapper as the immediate cause.
- Reproduced the same result through both the Vite remote binding and Wrangler's remote preview, checked that the account lists the models and Workers AI dashboard, and found no active Workers AI incident on Cloudflare's status page.
- Removed the diagnostic endpoint and restored required tool selection. Production deployment remains the next distinct runtime check; Cloudflare reference IDs are available in local development output if support is needed.
