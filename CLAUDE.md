# Alfursan Auto — Agent Instructions

## Branch Protection

**Never push directly to `main` without explicit user approval in the same conversation turn.**

- All work must be done on a feature or fix branch.
- To land changes on `main`, ask the user: _"Ready to merge to main and push?"_ and wait for confirmation before running any `git push origin main`, `git merge`, or `git cherry-pick` onto main.
- This applies to hotfixes, CI tweaks, and any other "small" changes — no exceptions.

## Database Migration Safety

**Never run migrations against the production Supabase database.**

- Migration development and testing is done exclusively against the **local Supabase stack** (`supabase start`).
- I must never run `supabase db push`, `supabase migration repair`, or any `supabase db` command that writes to remote unless the user explicitly types "push to production" in that conversation turn.
- I must never run `supabase login` or store production credentials.
- Production migrations are always performed by the user — I only prepare the SQL files.
