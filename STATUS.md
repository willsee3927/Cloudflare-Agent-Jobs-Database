# Current status

Last updated: 2026-09-18.

## Where we are

The application is built and verified locally. The Cloudflare account and `workers.dev` subdomain are ready, but permanent deployment is not complete.

- The initial request and current Cloudflare documentation informed `IMPLEMENTATION_PLAN.md`.
- The production mart was rebuilt and checked through the dedicated read-only application role.
- `AGENTS.md`, `README.md`, `DEVLOG.md`, and the prompt-history guide are in place.
- The user created `prompt-history/` and is saving the chats there. No conversation exports were present when the folder was inspected for this setup step.
- The React chat interface, Agents SDK Durable Objects, Workers AI interpretation, fixed parameterized search, persistent memory, deletion controls, signed visitor identity, rate limits, and daily AI cap are implemented.
- The production mart was rebuilt with source-aware remote values, `mart_built_at`, and a dbt-managed SELECT grant for the app role. Its 13 selected checks passed.
- The production mart contains 178,237 open rows. The corrected remote source changes 18,601 rows compared with the old text-only flag; 39,251 rows are now flagged remote.
- The dedicated `job_search_agent` login was verified to read only `analytics.mart_job_search`. Secrets exist only in gitignored local files and have not been uploaded to Cloudflare.
- Four test files pass: 23 tests including real PostgreSQL query fixtures, visitor-cookie isolation and renewal, hostile row rendering, input rejection, and a live search through the app role. Type checking, the production build, and a Wrangler deployment dry run pass.
- Cloudflare CLI login, official skills, five MCP definitions, and the account's `workers.dev` subdomain are configured.
- Remote development connects successfully, but the Workers AI binding returned a Cloudflare internal error for simple no-tool calls to both Llama 3.3 and Llama 3.1. Cloudflare's status page did not list an active Workers AI incident. The deployed runtime still needs to be tested because both development modes share the same proxy path.

## Next step

After explicit approval to transmit the database URL and session-signing key to the logged-in Cloudflare account, upload the two secrets, deploy, and run browser checks against the public URL. If Workers AI also fails in production, use the captured reference IDs for Cloudflare support and keep the safe error response active.

## Confirmed scope change

- Use `remote` instead of `location` and `state`; no city, state, country, or remote-US filtering.
- The six parameters are `role_family`, `seniority`, `remote`, `posted_within`, `min_salary`, and `limit`.
- Remove the planned state/country additions to the mart.

## Implemented search behavior

- One fixed `search_jobs` tool; default ten results, maximum twenty.
- `remote: true` selects flagged remote jobs; `false` selects jobs explicitly flagged false; null means no remote restriction. A false flag does not prove an on-site arrangement.
- Matching rows ordered by effective recency date with a stable posting-key tie-breaker.
- Date-based windows; “day” displayed as “since yesterday, UTC,” not an exact 24-hour publication claim.
- Explicit salary minimums exclude rows that cannot establish an annual USD minimum.
- Same-browser conversation history and explicitly saved preferences; no account system initially.

## Completed warehouse work

The mart exposes its build time, carries the fact table's source-aware remote flag, and preserves the application role's narrow SELECT grant across dbt rebuilds.

## Checks still outstanding

- Upload the two production secrets after explicit approval.
- Deploy and verify model/tool integration, memory persistence, visitor isolation, clearing, and error handling in the public runtime; resolve or escalate the Workers AI internal error if it reproduces there.
- Finish the prompt-history export and index before submission.

For completed work and evidence, see `DEVLOG.md`.
