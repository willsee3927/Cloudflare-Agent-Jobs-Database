# Cloudflare job-search agent: implementation plan

Research date: September 18, 2026. Updated the same day to replace location/state filtering with a remote flag at the user’s request. Status: implemented locally; public deployment checks remain.

## Recommendation

Build a small chat application in this repository using Cloudflare's Agents SDK, Workers AI, and the existing Neon warehouse. The model interprets the request and calls a single validated search tool. Application code owns the SQL, filtering, ranking, and result cards. The agent remembers conversations and explicitly saved preferences in its own durable storage.

Start with the official [Agents starter](https://github.com/cloudflare/agents-starter). Use TypeScript and its existing React chat interface. Remove unrelated sample tools, scheduling, image uploads, and external integrations.

The four assignment requirements are covered as follows:

- **LLM:** Workers AI, initially `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Its [model page](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/) explicitly lists function calling.
- **Coordination:** an Agents SDK chat agent running in a Durable Object, a server-side object with persistent storage. It coordinates interpretation, tool execution, and replies.
- **User input:** browser chat, served from the same Worker using [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).
- **Memory:** saved messages plus structured preferences and last-used filters in the Durable Object. [AIChatAgent](https://developers.cloudflare.com/agents/communication-channels/chat/chat-agents/) already persists messages in SQLite.

Workflows is unnecessary for a short interactive search; add it only if a later version needs scheduled searches or long-running work. Pages, D1, Vectorize, a separate API server, and a second copy of the jobs database are also unnecessary for this version.

The Greenhouse posting was later retrieved directly. The application form asks for the optional assignment's GitHub repository URL and says AI-assisted coding requires prompt history; it does not identify another assignment-specific upload field.

## What the existing project tells us

These findings come from local source files, not a fresh production database query:

- `dbt/models/marts/mart_job_search.sql` already produces one row per posting considered open at its last successful build. It includes job links, company, role family, seniority, salary, location, skills, and dates.
- Geography filtering is out of scope. No state/country columns need to be added to the mart; all application search queries remain directed at `analytics.mart_job_search`.
- The mart currently selects `location.is_remote`, a text-derived flag. The fact table has a source-aware `is_remote` field. Pass that field through instead and test explicit remote postings whose location text does not say “remote.”
- `first_listed` is `coalesce(first_seen, posted_date)`, not a uniform publication timestamp. `first_seen` is reduced to a date. `has_true_start = false` identifies postings present when a board was first tracked.
- Seniority is classified from titles. Unmarked titles default to `mid`; the interface must disclose that convention.
- Annual salary columns contain only per-annum USD values. They do not convert hourly pay or foreign currencies.
- `STATUS.md` records one ingestion per day and a September 17 repair after a failed downstream build. The recorded 178,084 open rows are a historical observation, not a live count verified for this plan.

The older `CLOUDFLARE_AGENT_PLAN.md` in the scraper repository is useful background. This proposal narrows its raw-description access and broad database grants, defines memory isolation, and makes ranking independent of model judgment.

## Request and result flow

1. The browser sends a message to the visitor's own agent.
2. The server supplies the model with recent messages, saved preferences, current filters, and the fixed tool definition.
3. The model selects `search_jobs` and supplies structured parameters, or asks a short clarification if the request cannot be represented.
4. Server code validates and normalizes every field before a query can run.
5. A checked-in parameterized query reads the mart, applies filters, orders matching rows, and returns at most the allowed result count.
6. The UI renders job cards directly from returned rows. The reply identifies the applied filters and any important limitations.
7. Messages and accepted filters are persisted for follow-up requests.

No general SQL tool, model-authored SQL, arbitrary table names, model-chosen ordering expressions, or runtime schema discovery.

## Search contract

Use six parameters, replacing the original `location` and `state` inputs with `remote`. Proposed initial behavior:

- **`role_family`:** optional array of canonical warehouse families. Map “data engineer” to `Data engineering`; maintain the allowlist from the repository's classification seeds, including `Unclassified`. Unknown values cause clarification, never an unfiltered fallback.
- **`seniority`:** optional array from `intern`, `junior`, `mid`, `senior`, `staff`, `principal`, `leadership`. “Mid range” means `mid`; “mid or below” means `intern`, `junior`, and `mid`.
- **`remote`:** optional nullable boolean bound to `is_remote`. `true` requires `is_remote IS TRUE`; `false` requires `is_remote IS FALSE`; null means no remote restriction, including rows with an unknown flag. On a fresh search, default to null unless an explicit saved preference says otherwise. “Only remote” sets true; “include all jobs” clears it to null. False means “not flagged remote,” not confirmed on-site or non-hybrid. A remote flag does not establish country eligibility. City, state, country, and remote-US requests are unsupported: explain that limitation and ask whether a search without the geographic restriction is acceptable rather than silently dropping it.
- **`posted_within`:** `day`, `week`, `month`, or `any`; proposed default `week`. Because the current data is date-grained, define `day` as “since yesterday, UTC,” `week` as today plus the preceding six dates, and `month` as today plus the preceding 29 dates. Show the actual inclusive date range. Never describe this as an exact rolling 24-hour search. Use the server's current UTC date, not the newest row's date, as the anchor.
- **`min_salary`:** optional nonnegative annual USD amount. Require `salary_annual_min >= min_salary`. Unknown, hourly, and non-USD salaries cannot establish this condition, so exclude them when a minimum is requested. If no minimum is requested, keep them and display their original units where available.
- **`limit`:** integer, default 10, allowed range 1–20. Explicitly cap larger requests and report the cap; reject malformed values.

Arrays mean OR within a field; different fields combine with AND. Null means no restriction. Cap array lengths and string lengths, reject unexpected keys, and treat all model output as untrusted input.

For recency, use employer `posted_date` when present; otherwise use `first_seen` only when `has_true_start` is true. Keep this fixed expression in the application query and return whether the result date means “posted” or “first observed.” Rows without a trustworthy recency date remain eligible for `any`, but not a recent-only search. This prevents adding an old board from making all of its jobs appear newly posted. Null and future dates must not count as recent.

For the example request, the normalized filters are Data engineering, mid, since yesterday UTC, no remote restriction, no minimum salary, and 10 results. Display “Mid includes titles with no stated level” and label each date accurately.

If precise 24-hour windows are essential, add source publication and first-observed timestamps to the mart in a separate step. Even then, first observation cannot prove publication time, and daily collection is not real-time coverage.

## Ranking and output

Use an explicit, reproducible ranking rule for version one: apply every requested filter, then order by the effective recency date descending, nulls last, with `posting_key` as a stable tie-breaker. Apply `LIMIT` after this ordering in the database. “Top matches” means the newest eligible matches under these rules, not an assessment of the user's qualifications.

This is appropriate because the proposed inputs are hard filters. There is no résumé, skills preference, or full description in the contract from which to infer a more personal fit score. Keep LLM reranking as a later, separately evaluated feature.

Each card includes title, company, remote-flag label, salary and units or “not listed,” source, the labeled date, and an application link. Match reasons come from the applied filters and row values. Do not let generated prose invent URLs, salaries, qualifications, or posting availability.

Return fewer than ten when fewer match. A zero-result response shows the actual filters and offers a wider date window or removal of the remote restriction; it does not silently loosen them. Do not claim how many jobs a relaxed search would find unless that query actually ran. Database failures must produce an error state, never “no jobs found.”

The table is materialized, so “open” means the last successful build considered it open. Recheck known application closing dates at query time. Add `mart_built_at` to the mart for an honest refresh label; if no rows can supply it, report freshness as unavailable. It measures this table's build time, not successful ingestion of every source. Avoid substituting `max(first_listed)` for refresh time.

## Database boundary

Use [`@neondatabase/serverless`](https://neon.com/blog/serverless-driver-ga) over HTTPS. It supports Cloudflare Workers and bound query parameters. A small read-only query per turn does not require an additional connection service.

Create a dedicated role with schema usage and SELECT permission only on `analytics.mart_job_search`. Store its connection string as a Worker secret, never in frontend code or source control. Verify effective permissions, including inherited/PUBLIC privileges, rather than relying only on the role's name.

Use fixed SQL text with separately bound values. No unsafe string interpolation. A database statement timeout and request timeout limit expensive searches. Inspect representative query plans before adding indexes; maintain any needed indexes through dbt so rebuilding the table preserves them.

Because dbt rebuilds tables, configure a model-specific SELECT grant in dbt and prove it survives a rebuild in an isolated test environment. Do not solve this with SELECT on every current and future table in `analytics` or `raw`.

[Hyperdrive supports Neon](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/neon/) and is a reasonable later optimization if measured latency calls for it. If selected, use a supported TCP Postgres driver rather than layering the HTTP driver through it. The earlier plan's claim that Hyperdrive requires a paid plan is outdated: the [current pricing page](https://developers.cloudflare.com/hyperdrive/platform/pricing/) lists both free and paid plans. Check actual account limits at setup.

## Memory and visitor isolation

For the first version, use one persistent conversation per browser identity. A server-issued random identifier in a signed, Secure, HttpOnly, SameSite cookie selects the visitor's Durable Object. The server must derive/authorize the object name on every HTTP request and WebSocket connection; a client-selected object name is not authorization. Check connection origins. Cloudflare provides [routing hooks](https://developers.cloudflare.com/agents/runtime/communication/routing/) for these checks.

Persist:

- Conversation messages, with a proposed cap of 200 retained messages.
- The last validated filters, so “only remote” sets `remote: true` while preserving the role and level.
- Explicit saved preferences, so “remember that I prefer remote work” survives later visits.

Use a small validated preference object rather than an unrestricted profile paragraph. Current explicit instructions override saved defaults. One search for remote jobs should not silently become a permanent remote-only preference. Allow inspection and deletion of preferences, clearing the conversation, and forgetting all saved data. Enforce a proposed 30-day inactivity expiration with deletion, not merely a UI label.

Model context is bounded separately from stored history: send the latest messages plus validated filters/preferences, not every historical result card. Older facts outside that context are not automatically recalled. Browser memory survives reloads and browser restarts while the cookie and stored data remain; cross-device memory requires accounts and is deferred.

Keep secrets outside client-synchronized state. Treat stored messages and job text as untrusted data, never as privileged instructions. The application must also validate direct browser calls; the LLM is not the sole route to tools.

## Build sequence and evidence of completion

### 1. Capture the assignment and establish the data contract

Save this planning conversation and every subsequent AI coding session in `prompt-history/`, with dates and a small index. Preserve actual prompts and useful responses; a reconstructed summary is not a full prompt history. Redact credentials explicitly. Keep runtime system prompts in source control too, but do not confuse them with the required coding-assistance history.

Finalize the proposed date/remote/salary meanings above. Inspect current mart column types and representative rows using a read-only connection. Record source coverage, nulls, allowed values, and query plans. Changes proposed here are not yet verified against production.

**Done when:** the six parameters have documented meanings and representative inputs have agreed expected results.

### 2. Build a minimal Cloudflare shell

Scaffold the official starter in this app repository, remove unrelated tools, configure Llama 3.3, and pin working dependency versions. The starter requires Cloudflare authentication even for local Workers AI calls. Establish per-visitor routing and initial request limits before exposing a public demo. Deploy a small smoke test early to validate the actual Cloudflare runtime.

**Done when:** the deployed app responds, survives reload, and two browser identities cannot see one another's history.

### 3. Prepare and verify the read-only search path

In the scraper repository, add build time to the mart, carry the fact's remote flag through, add narrow grants, and test the affected models. Keep existing user changes intact. In this repository, implement validation and the fixed query before connecting the model to it.

**Done when:** direct test searches produce expected rows; invalid inputs fail before database access; the app role cannot read raw data or write; SELECT still works after a test rebuild.

### 4. Connect chat to search and render results

Add `search_jobs`, the bounded tool loop, applied-filter display, and cards populated from database results. Allow one search execution per user turn and at most one model repair of invalid arguments before returning a clarification. Store successfully accepted filters for follow-ups. Do not execute concurrent searches within a single visitor's turn; prevent late responses from overwriting newer filters.

**Done when:** the example request works end to end, “only remote” retains role/seniority, empty results are honest, and database errors remain distinguishable from empty results.

### 5. Finish memory and public-demo limits

Implement explicit preference saving, clear/forget controls, expiration, and reconnect behavior. Bound message size, context size, output tokens, database duration, and tool steps. Apply per-visitor and per-IP request limits plus an application-wide daily AI allowance with an enforced cutoff; monitoring alone is not a spending cap. Log latency, validated filters, result count, model usage, and error category without credentials or full conversations by default.

**Done when:** preferences survive reconnects, overrides work, deletion removes saved state, and isolation/limits fail safely under forced tests.

### 6. Test and package the submission

Use focused automated tests for normalization, SQL parameter binding, date boundaries, null salaries, true/false/null remote filtering, stable ranking, and memory precedence. Include malicious text in both user input and a fixture job title, manipulated object names, prompt-injection attempts, and database/model failures. Test on the deployed runtime as well as locally.

Maintain a small prompt evaluation set with expected filters: the original request; “mid or below”; “only remote”; “at least $120k”; “remove the salary minimum”; “last seven days”; “include all jobs” to clear the remote filter; and unsupported geographic/skill requests. Invalid model output must never trigger a broad fallback query. Fixed-query integration tests use deterministic fixtures; production smoke tests verify invariants rather than hardcoded row counts.

Write the README with architecture, setup, secret names, query/ranking rules, data limitations, memory scope, and reproducible tests. Include the deployed link, a short recorded demonstration, and indexed prompt history. Recheck the full assignment's submission instructions.

**Done when:** a reviewer can open the app, reproduce a search and follow-up, reload to verify memory, understand why results were selected, and inspect the coding prompt history.

## Scope and remaining setup dependencies

The first version is conversational filtering and browsing. City/state/country filtering, description retrieval, résumé matching, embeddings, AI reranking, job alerts, saved applications, voice, account login, and cross-device memory are later work.

Setup still requires a usable Cloudflare account/login, appropriate database-owner access to create the narrow app role and dbt grants, and verification of current quotas. This research did not inspect credentials or call the production database. [SQLite-backed Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/) are available on the free plan; actual suitability depends on the demo's usage and current limits.

The first implementation milestone should be the fixed query contract and a small deployed shell. Explain and verify each milestone before moving to the next so the finished application is something its author can defend in an interview.
