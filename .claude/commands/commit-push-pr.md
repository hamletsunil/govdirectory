Create a commit, push, and open a PR:

1. Run `git status` and `git diff --stat` to understand what changed
2. Run `npm run build` to verify the build passes
3. Stage the relevant files (not `.env*`, not `node_modules/`)
4. Write a concise commit message: "Add/Fix/Update [what]: [brief why]"
5. Push to origin
6. Create a PR with `gh pr create` including a summary and test plan

Stop and ask if the build fails.
