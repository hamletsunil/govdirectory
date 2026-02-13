Run a full build check before pushing:

1. Run `npx tsc --noEmit` to typecheck
2. Run `npm run lint` to lint
3. Run `npm run build` to verify the production build succeeds

Report any errors found. Do not push if any step fails.
