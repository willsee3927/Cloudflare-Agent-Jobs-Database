# AI coding prompt history

This folder holds the actual coding-assistance conversations used to build the application. The assignment excerpt requires prompt history, and the user is saving the chats here.

## Saving a conversation

1. Save an export or copy of the conversation, including the user's prompts and the assistant's responses. Preserve code and relevant tool results when the export supports them.
2. Use a dated filename such as `2026-09-18-01-planning.md` or `2026-09-18-02-project-setup.md`. Keep the native export format when needed; do not rename a non-Markdown export to `.md`.
3. Include the session date and assistant/model if known. If a session is split across files, number the parts in order.
4. Review for credentials, connection strings, tokens, and private account information before committing. Replace sensitive values with an explicit marker such as `[REDACTED: database credential]` while preserving the surrounding conversation.
5. Preserve original wording and chronology. Label an excerpt or summary as such; never present reconstructed content as a complete transcript.

Use one file per session or numbered part. Keep existing exports intact; do not overwrite one with a later conversation. A final export may include turns after an earlier partial copy—label that relationship to avoid confusing duplicates.

## Coverage

Capture the initial research/planning conversation, this documentation setup, and every later AI-assisted implementation or debugging session. Include sessions from other assistants if they contribute to the project.

Runtime system prompts belong in the application's source as well. They are separate from the coding-assistance history and do not replace it. Private conversations from people using the deployed app do not belong in this folder.

## Transcript index

- [September 18, 2026 — planning and implementation, partial export](prompt%2020260918.md)

This README is guidance, not a transcript. The indexed file is the user-provided conversation export with the Cloudflare account email and dashboard account identifier replaced by explicit redaction markers. The conversation itself has not been reconstructed. It ends as production deployment begins; add the remaining conversation at the end of development, then review that export for private information before submitting the assignment.
