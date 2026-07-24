---
description: Update README.md and AGENTS.md to reflect the latest project state after feature changes.
agent: build
---

Update documentation files to match the current codebase.

**Steps:**
1. Read `README.md` and `AGENTS.md`
2. Review what changed recently: run `git diff HEAD~3 --stat` or `git log --oneline -5` to understand recent work
3. Read the affected source files to understand current architecture
4. Update `README.md`:
   - Project description, tech stack, setup instructions
   - Feature list (add new features, remove deprecated ones)
   - Environment variables if changed
   - Any new scripts or commands
5. Update `AGENTS.md`:
   - Project structure (new files/directories)
   - Architecture (new contexts, hooks, components)
   - Routing table (new pages)
   - Data schemas (new tables/fields)
   - Key patterns (new conventions)
   - Known issues / improvement roadmap
6. Run `git diff --stat` to verify changes look correct
7. Report what was updated in each file

**Rules:**
- Match existing tone and format in each file
- Keep descriptions accurate to current code, not aspirational
- Don't add comments to code, only update the markdown docs
- If arguments are provided: `$ARGUMENTS` — focus updates on that specific area
