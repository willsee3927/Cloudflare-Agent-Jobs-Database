# Current status

Last updated: 2026-09-18 (final security and documentation sweep).

## Where we are

The application is deployed and verified at [cf-job-search-agent.wjcc91.workers.dev](https://cf-job-search-agent.wjcc91.workers.dev).

- The initial request and current Cloudflare documentation informed `IMPLEMENTATION_PLAN.md`.
- The production mart was rebuilt and checked through the dedicated read-only application role.
- `AGENTS.md`, `README.md`, `DEVLOG.md`, and the prompt-history guide are in place.
- A user-provided coding-conversation export is saved in `prompt-history/` and indexed. It ends before the production deployment work, so a final export is still needed. The present file was checked for common credential patterns.
- The React chat interface, Agents SDK Durable Objects, Workers AI interpretation, fixed parameterized search, persistent memory, deletion controls, signed visitor identity, rate limits, and daily AI cap are implemented.
- The production mart was rebuilt with source-aware remote values, `mart_built_at`, and a dbt-managed SELECT grant for the app role. Its 13 selected checks passed.
- The production mart contains 178,237 open rows. The corrected remote source changes 18,601 rows compared with the old text-only flag; 39,251 rows are now flagged remote.
- The dedicated `job_search_agent` login was verified to read only `analytics.mart_job_search`. Its URL and the session-signing key are stored by Cloudflare as encrypted Worker secrets; local copies remain gitignored.
- Four test files pass: 25 tests including real PostgreSQL query fixtures, deterministic grounding of explicit user filters, visitor-cookie isolation and renewal, hostile row rendering, input rejection, and a live search through the app role. Type checking and the production build pass.
- Cloudflare CLI login, official skills, five MCP definitions, and the account's `workers.dev` subdomain are configured.
- The production Workers AI binding succeeds. Public evaluation covered the assignment example, remote follow-ups, salary removal, broader remote inclusion, unsupported location and skill requests, durable reloads, visitor isolation, all deletion controls, origin rejection, and closed generic agent routes.
- Production logs redact cookies. The application now also omits model error text and search filters from its own logs; it records only event type, elapsed time, and result count.
- A later scheduled warehouse build briefly removed the then-unpushed `mart_built_at` column. The mart was rebuilt from the current model (13/13 dbt checks), after which all 25 app tests and a public ten-result search passed. The model is now pushed to GitHub for the next scheduled rebuild.
- The security sweep found and corrected owner-readable secret-file permissions and over-detailed application logs. The partial prompt export and reachable Git history now redact a Cloudflare account email and dashboard identifier. The GitHub repository is private.

## Next step

The reviewed application source and warehouse mart model are pushed to their existing GitHub repositories. The user will add the remainder of the prompt-history export at the end of development. Review and push that final export before submission.

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

- Complete the prompt-history export with the remaining deployment and verification conversation, then push it to the application repository.
- Confirm the final prompt-history export contains no account identifiers, credentials, or private account information before the repository is made public or shared with reviewers.
- Make the private application repository accessible to Cloudflare reviewers when submitting its URL.
- Put the repository URL in the application form; submitting the job application remains a user action.

For completed work and evidence, see `DEVLOG.md`.
