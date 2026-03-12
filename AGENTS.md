# Board Enthusiasts Frontend

## Coding Standard

- Build the maintained frontend as a React + TypeScript SPA using the checked-in Vite toolchain.
- Keep routine frontend workflows reachable from the root CLI (`python ./scripts/dev.py ...`) even when submodule-local commands also exist.
- Prefer route components and small helper functions over giant stateful single-purpose modules, but do not split files mechanically when the logic is still easiest to follow together.
- Cover maintained route behavior with automated frontend tests.
- Do not reintroduce removed frontend runtime dependencies into the maintained path.
- Keep public assets that are still needed by local seed/demo workflows under `public/`; delete stale frontend assets instead of leaving duplicates behind.
