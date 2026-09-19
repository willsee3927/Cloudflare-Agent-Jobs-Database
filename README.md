# Cloudflare job-search agent

A chat application for finding job postings in an existing job-board warehouse.

Example request:

> Mid range data engineering jobs posted in the last day.

The model translates the request into validated parameters. Application code executes fixed queries against `analytics.mart_job_search` and returns roughly ten matching postings with application links. Persistent conversation state supports follow-ups such as “only remote.”

**Current status:** the application is deployed at [cf-job-search-agent.wjcc91.workers.dev](https://cf-job-search-agent.wjcc91.workers.dev). Its fixed search query, durable memory, browser interface, Workers AI integration, and production warehouse boundary have been verified in the public runtime. See [STATUS.md](STATUS.md).

## Assignment

This project is being built for the [Cloudflare job posting](https://job-boards.greenhouse.io/cloudflare/jobs/8212060). The supplied assignment excerpt asks for an LLM, workflow/coordination, chat or voice input, memory/state, and AI coding prompt history.

The implementation uses Workers AI for the model, an Agents SDK Durable Object for coordination and storage, and a browser chat interface served by a Worker. Job data remains in the existing Neon Postgres warehouse.

The full posting was checked on September 18, 2026. Its assignment field asks for a GitHub repository URL and requires the AI coding prompt history; it does not list another assignment-specific upload field.

## Design boundaries

- The model chooses parameters, never SQL.
- Database credentials grant read access only to the search mart.
- Results are filtered and ranked by application-owned rules.
- Conversations are isolated per visitor; initial memory is limited to the same browser.
- Search uses the remote flag only; city, state, and country filters are out of scope.
- Dates, inferred seniority, missing salary, and remote-flag limitations are labeled honestly.

These boundaries are implemented in the server and verified by unit, PostgreSQL fixture, and live read-only search tests. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) records the design and tradeoffs.

## Project documents

- [AGENTS.md](AGENTS.md): instructions for coding assistants working in this repository.
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): researched architecture and execution plan.
- [STATUS.md](STATUS.md): present state, remaining checks, and the next action.
- [DEVLOG.md](DEVLOG.md): dated record of completed work and verification.
- [Prompt history](prompt-history/README.md): how coding conversations are saved for submission.
- [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md): final deployment and application-package checks.

## Development setup

Requirements: Node.js 20 or newer, a Cloudflare login, and access to the sibling warehouse's `.env.neon` file.

```bash
npm install
npm run types
npm test
npm run check
npm run build
```

`scripts/provision_database.py` creates or rotates the `job_search_agent` role, proves that it can read only `analytics.mart_job_search`, and writes gitignored, owner-only local secret files. It requires `psycopg2` and `python-dotenv` from the warehouse's Python dependencies. Run it from this repository's root:

```bash
python3 scripts/provision_database.py ../Job\ Board\ Scraper\ Fable/.env.neon
```

Run the optional production smoke test after provisioning:

```bash
set -a; source .dev.vars; set +a
LIVE_DATABASE_URL="$DATABASE_URL" npm test
```

`npm run dev` uses remote Workers AI and therefore requires Cloudflare authentication and an enabled `workers.dev` account subdomain. Local secrets come from `.dev.vars`; never commit that file.

For deployment, upload `.prod.secrets` with `npx wrangler secret bulk .prod.secrets`, then run `npm run deploy`. The production Worker already has both encrypted secrets. **Provisioning rotates the database password and session-signing key**, so do not rerun it without immediately updating both Worker secrets; rotation also ends existing browser sessions.

The warehouse is maintained separately in the sibling `Job Board Scraper Fable` repository. Its instructions remain authoritative for warehouse changes. The search mart grants SELECT to `job_search_agent` through dbt so that access survives table rebuilds.

## Search behavior

The six supported filters are `role_family`, `seniority`, `remote`, `posted_within`, `min_salary`, and `limit`. The default search covers seven UTC calendar dates and returns ten postings; the hard maximum is twenty.

Results are ordered by a trustworthy effective date, then by posting key. Employer publication dates take priority. A private-board `first_seen` date is used only when the pipeline actually observed the posting arrive. Minimum salary means published annual USD minimum; postings without enough salary information are excluded when that filter is present.

The interface discloses that unmarked titles classify as mid-level, first-observed dates are not publication dates, and a remote flag does not establish geographic eligibility.

## Memory and deletion

Each browser receives a server-signed random identity. Its Durable Object stores up to 200 messages, the last accepted filters, and only preferences the user explicitly asks to remember. Stored data expires after 30 days of inactivity. The interface can clear the conversation, clear preferences, or delete everything.

## Security and privacy

The model receives the conversation and validated filter state, but not database credentials or job rows. Only application code runs the fixed SQL query, using a database login granted SELECT on the search mart alone. The browser receives job cards, never credentials. Signed, HttpOnly, same-site cookies isolate conversations; write requests require the same origin. Request size, model calls, search time, results, and retained history are bounded.

Local `.dev.vars` and `.prod.secrets` files are owner-readable only and ignored by Git. The build removes the copied development secret file before deployment. Application logs report event type, elapsed time, and result count without recording prompts, filters, database errors, or credentials. The currently indexed [prompt-history export](prompt-history/README.md) is partial; the final conversation export will be added at the end of development.
