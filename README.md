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

## Environment Files

This submodule does not own the maintained `.env` files for the stack.

The supported environment files are root-managed under [`../config`](../config):

- [`../config/.env.local.example`](../config/.env.local.example)
- [`../config/.env.staging.example`](../config/.env.staging.example)
- [`../config/.env.example`](../config/.env.example)

For hosted frontend builds, the important public runtime values are:

- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_LANDING_MODE`

Use the root CLI to inspect or bootstrap the root-managed files:

```bash
python ./scripts/dev.py env local --copy-example
python ./scripts/dev.py env local --open
```
