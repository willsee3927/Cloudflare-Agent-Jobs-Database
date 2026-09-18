# Submission checklist

The Cloudflare application form asks for the GitHub repository URL for the optional assignment. It also says AI-assisted coding requires prompt history.

## Required before submission

- [x] Enable this account's `workers.dev` subdomain.
- [ ] Upload `DATABASE_URL` and `SESSION_SECRET` as encrypted Worker secrets.
- [ ] Deploy and record the public application URL below.
- [ ] Verify the example search and a follow-up such as “only remote” in the deployed app.
- [ ] Reload and confirm the same browser retains its conversation.
- [ ] Confirm a separate browser identity cannot see that conversation.
- [ ] Exercise Clear conversation, Clear preferences, and Forget everything.
- [ ] Review Cloudflare logs and traces for runtime failures without exposing prompts or secrets.
- [ ] Export the complete AI coding conversation into `prompt-history/`, redact credentials, and add a dated index.
- [ ] Commit and push the reviewed source and prompt history to GitHub.
- [ ] Put the repository URL in the application form's optional-assignment field.

## Submission links

- Repository: https://github.com/willsee3927/Cloudflare-Agent-Jobs-Database
- Live application: pending deployment

## Evidence already complete

- Workers AI uses Llama 3.3 with required structured tool selection.
- An Agents SDK Durable Object coordinates each browser's chat and durable memory.
- A same-origin React chat accepts natural-language requests and renders database-owned job cards.
- The model can choose only six validated search parameters; fixed parameterized SQL queries only `analytics.mart_job_search`.
- The database login can read that mart and no other `analytics` or `raw` table.
- Type checking, production build, Wrangler dry run, 22 automated tests, targeted dbt build/tests, and a live read-only database search pass.
