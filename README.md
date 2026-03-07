# board-enthusiasts_frontend

A frontend interface for Board Enthusiasts users to browse the public catalog, use authenticated player routes, and manage developer studios and titles once developer access is enabled.

Developer studio/title create and settings flows now auto-generate kebab-case slugs from display names instead of requiring manual slug entry.

Planning artifacts for the web UI live in [`planning/`](planning/README.md).

## Current Structure

- `Board.ThirdPartyLibrary.Frontend.slnx`: frontend solution
- `src/Board.ThirdPartyLibrary.Frontend.Web/`: Blazor Web App
- `tests/Board.ThirdPartyLibrary.Frontend.Web.Tests/`: route smoke tests plus focused UI utility/unit coverage (for example slug normalization)
- `planning/`: frontend planning, ADRs, and wireframes

## Local Workflow

Install frontend dependencies once:

```bash
npm install
```

Build Tailwind CSS:

```bash
npm run css:build
```

Run the web app:

```bash
npm run start
```

`npm run start` now uses `dotnet watch`, so Razor page and component edits hot reload while the app is running.

For authenticated flows such as `/signin`, local Keycloak must be running on `https://localhost:8443`, the backend API must be available on `https://localhost:7085`, the frontend should be served locally at `https://localhost:7277`, and local registration/verification emails are captured in Mailpit at `https://localhost:8025`.
From the repo root, the simplest setup is:

```bash
python ./scripts/dev.py web --hot-reload
```

Run the frontend tests:

```bash
npm run test
```
