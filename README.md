# board-enthusiasts_frontend

The maintained frontend for Board Enthusiasts now lives here as a React + TypeScript SPA built with Vite.

Planning artifacts remain in [`planning/`](planning/README.md).

## Current Structure

- `src/`: maintained SPA source
- `public/`: checked-in frontend public assets, including local seed media used by root seeding workflows
- `package.json`: frontend package manifest and scripts
- `planning/`: frontend planning and ADR history

## Local Workflow

Install dependencies:

```bash
npm install
```

Run the maintained frontend:

```bash
npm run dev
```

Typecheck and test:

```bash
npm run typecheck
npm run test
```

From the repo root, the default workflow remains:

```bash
python ./scripts/dev.py web --hot-reload
```

That path starts local Supabase, the Workers API, and this SPA together.
