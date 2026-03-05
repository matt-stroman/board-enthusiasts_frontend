# Board Third Party Library Frontend

## Coding Standard

- Build UI with declarative Razor markup and standard Blazor binding/event patterns.
- Do not implement page content with manual `RenderTreeBuilder`/`AddMarkupContent` composition for normal feature work; this is harder to maintain and has proven fragile with hot reload and interactive server rendering.
- Keep Blazor enhanced navigation enabled by default to preserve responsive client-side transitions.
- Disable enhanced navigation only for targeted links or routes with a known, documented compatibility issue by using `data-enhance-nav="false"`.
- When enhanced navigation is disabled for a route/link, add a brief comment or PR note explaining why and what conditions are required to remove the override.
- Keep interaction logic in-place when possible (tab/workflow switching without route changes) and use API calls behind the current route for refresh/mutation flows.
- Preserve resilience: UI failures should degrade gracefully and keep the shell interactive where possible.
- Cover new route and navigation behavior with automated frontend tests (including route smoke tests where applicable).
- Work from a branch, commit the completed change set, push it, and open or update a PR.
- Wait for the relevant GitHub workflow runs, inspect failures, and push fixes until the branch is green.
- Merge to `main` only after the required checks pass and the PR is reviewed.
- After the PR is merged, delete the merged branch locally and remotely, prune stale remote refs, and leave the repository on a clean `main` tracking `origin/main`.
