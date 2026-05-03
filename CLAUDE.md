# Alfursan Auto — Agent Instructions

# AGENTS.md

This file provides instructions for AI coding agents (GitHub Copilot, Claude Code, Codex, etc.) working in this repository.

## Build Commands

- npm run build

## Code Style

- Use TypeScript strict
- Prefer functional components over class components
- When writing tasks to a Markdown file, format each task with a checkbox, a description, validation criteria, and steps to test once done

## Workflow

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) format
- Create feature branches from `main`, do not commit straight to 'main', use githubs new stacked PR feature to break up large features into smaller PRs with clear dependencies
- Always run `npm run build` before committing to verify no TypeScript errors
- **Before merging or pushing to `main`: update `CHANGELOG.md`** under the `[Unreleased]` section with a summary of what changed (Added / Changed / Removed / Fixed)
- make sure to add tests whenever a new feature is added or a bug is fixed, and run all tests before merging to main
- do not push to main without asking the user for confirmation in the same conversation turn, even for hotfixes or small changes. Always ask: _"Ready to merge to main and push?"_ and wait for confirmation before running any `git push origin main`, `git merge`, or `git cherry-pick` onto main.
- This applies to hotfixes, CI tweaks, and any other "small" changes — no exceptions.

## Branch Protection

**Never push directly to `main` without explicit user approval in the same conversation turn.**

- All work must be done on a feature or fix branch.
- To land changes on `main`, ask the user: _"Ready to merge to main and push?"_ and wait for confirmation before running any `git push origin main`, `git merge`, or `git cherry-pick` onto main.

## Database Migration Safety

**Never run migrations against the production Supabase database.**

- Migration development and testing is done exclusively against the **local Supabase stack** (`supabase start`).
- I must never run `supabase db push`, `supabase migration repair`, or any `supabase db` command that writes to remote unless the user explicitly types "push to production" in that conversation turn.
- I must never run `supabase login` or store production credentials.
- Production migrations are always performed by the user — I only prepare the SQL files.
