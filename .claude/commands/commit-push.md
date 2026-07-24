---
description: Commit all changes and push to GitHub. Excludes graphify-out, supabase/.temp, dist/, node_modules/, and temp analysis scripts.
agent: build
---

Commit all staged and unstaged changes, then push to GitHub.

**Steps:**
1. Run `git status` to see all changes
2. Run `git diff --stat` to understand the scope
3. Check recent commit messages with `git log --oneline -5` for style reference
4. Stage all relevant files (exclude: `graphify-out/`, `supabase/.temp/`, `dist/`, `node_modules/`, `*.py` analysis scripts like `analyze_*.py`, `check_*.py`, `query_*.py`, `dream_*.py`)
5. If arguments are provided: `$ARGUMENTS` — use them as the commit message. Otherwise, draft a concise commit message describing the changes.
6. Commit with `git commit`
7. Push with `git push`
8. Report: commit hash, files changed count, and push status

**Commit message style:** concise, imperative mood, Indonesian or English mix matching project conventions.
