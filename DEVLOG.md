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

## 2026-09-18 — Freshness and untrusted-row rendering

- Added the search mart's actual build timestamp to each result set's explanatory text, with an explicit “unavailable” state when no matching row can supply it.
- Added a server-rendering test with hostile HTML in the title and company plus a `javascript:` application URL. React escapes the row text, no script element is produced, and the unsafe link is replaced with “Application link unavailable.”
- The full suite now passes 23/23, including the live read-only database smoke test. Type checking and the production build still pass, and the build output still removes the copied development secret file.

## 2026-09-18 — Production deployment and evaluation

- Uploaded the read-only Neon URL and random session-signing key as encrypted Cloudflare Worker secrets after explicit user authorization, then deployed the application to `https://cf-job-search-agent.wjcc91.workers.dev`.
- Confirmed Workers AI succeeds in production. The assignment example resolves to Data engineering, mid-level, and the one-day window; “Only remote” preserves those filters and adds the remote constraint.
- Added an application-owned grounding layer for explicit role, seniority, date, salary, result-count, and remote language. This prevents the model from broadening explicit requests and keeps unrelated filters during follow-ups. The expanded suite contains 25 tests.
- Public checks passed for salary filters and removal, inclusive seniority, unsupported location and skill requests, same-browser reload memory, separate-browser isolation, conversation/preference/full deletion, same-origin enforcement, and closed generic agent routes.
- Reviewed live tail output. Cloudflare redacts the session cookie, and application telemetry excludes prompts, request bodies, database credentials, and signing keys.
- Added the user-provided prompt-history export to its dated index and checked it for common credential patterns without changing its contents. The file ends as production deployment begins, so a final export is still required before submission.

## 2026-09-18 — Scheduled warehouse rebuild exposed a source-control gap

- After the final Worker deploy, the public search returned a database connection error. A repeat of the live read-only test gave the precise cause: the scheduled warehouse build had replaced `mart_job_search` from GitHub's older model, which lacks `mart_built_at`.
- Rebuilt the production mart from the current local model. All 13 selected dbt nodes, all 25 application tests, and the public assignment search then passed; the public query returned ten matching postings.
- Committed the warehouse model, test, and evidence notes locally. Its scheduled build will keep the fix only after that commit reaches the warehouse repository's GitHub remote.
- Corrected preference-saving so the active filters use the same application-grounded patch as the saved preferences.
- Final type checking, production build, and all 25 tests passed; the final Worker version returned ten correctly filtered public results with a mart build timestamp. The reviewed application source and current partial prompt export were pushed to `willsee3927/Cloudflare-Agent-Jobs-Database` after explicit authorization.
- After the user reviewed the effect on existing postings and explicitly authorized the warehouse destination, pushed the mart model to `willsee3927/Job-Board-Scraper-Fable` at `3206772`. This lets the scheduled build retain the deployed app's required column and grant.

## 2026-09-18 — Final security and documentation sweep

- Checked tracked files, Git history, and the production build for the exact Neon URL and signing key: neither value appeared. The development and production secret files are Git-ignored and absent from the build, but their local permissions were too broad; changed both to owner-only and updated provisioning to maintain that mode.
- Removed model error text and user-selected filters from application logs. Database errors remain a safe service-error message in the browser, without suggesting an empty result.
- Found one account email and one dashboard account identifier repeated in the partial user-provided prompt export. Replaced them with explicit redaction markers, then rewrote the private repository's sole branch so no reachable commit retains the originals. Verified the final tree matches the tested local tree and the rewritten history has no matching identifiers.
- Updated the README with the working Python invocation, secret rotation warning, and the application's security and privacy boundaries. The final conversation export remains intentionally deferred until the end of development.
