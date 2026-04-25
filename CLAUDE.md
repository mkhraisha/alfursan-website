# Alfursan Auto — Agent Instructions

## Branch Protection

**Never push directly to `main` without explicit user approval in the same conversation turn.**

- All work must be done on a feature or fix branch.
- To land changes on `main`, ask the user: _"Ready to merge to main and push?"_ and wait for confirmation before running any `git push origin main`, `git merge`, or `git cherry-pick` onto main.
- This applies to hotfixes, CI tweaks, and any other "small" changes — no exceptions.
